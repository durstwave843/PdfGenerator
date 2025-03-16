// app.js - Main application file
const express = require('express');
const bodyParser = require('body-parser');
const pdf = require('html-pdf');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { generateTemplate } = require('./templateGenerator');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint - Expanded status page
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>PDF Generator Service</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #062841; }
          .status { background: #e6f7e6; border-left: 4px solid #28a745; padding: 10px; }
        </style>
      </head>
      <body>
        <h1>PDF Generator Service</h1>
        <div class="status">
          <p>✅ Service is running</p>
          <p>Ready to accept webhook data from JotForm</p>
        </div>
        <p>Last started: ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `);
});

// Main webhook endpoint for JotForm
app.post('/webhook', async (req, res) => {
  console.log('Received webhook data');
  
  try {
    // Log raw data - complete request body
    console.log('Complete request body:', JSON.stringify(req.body, null, 2));
    
    // Check for JotForm specific fields (submissionID and rawRequest)
    if (req.body.submissionID) {
      console.log('JotForm submission ID:', req.body.submissionID);
    }
    
    // Get the rawRequest data - this is how JotForm sends the form fields
    let formData = {};
    
    if (req.body.rawRequest) {
      console.log('Raw request found, parsing JSON');
      
      // If rawRequest is a string (JSON), parse it
      if (typeof req.body.rawRequest === 'string') {
        try {
          formData = JSON.parse(req.body.rawRequest);
          console.log('Successfully parsed rawRequest JSON');
        } catch (error) {
          console.error('Error parsing rawRequest JSON:', error);
          formData = req.body.rawRequest; // Use as is if not valid JSON
        }
      } else {
        // If rawRequest is already an object
        formData = req.body.rawRequest;
      }
    } else {
      // Fall back to the entire request body if no rawRequest is found
      formData = req.body;
    }
    
    console.log('Parsed form data:', JSON.stringify(formData, null, 2));
    
    // Log all available field names for debugging
    console.log('Available fields:', Object.keys(formData));
    
    // Extract field values using cleaner names for the PDF
    const cleanData = extractFormFields(formData);
    console.log('Cleaned form data:', JSON.stringify(cleanData, null, 2));
    
    // Generate PDF
    const pdfBuffer = await generatePDF(cleanData);
    
    // Create filename
    const timestamp = new Date().getTime();
    const homeownerName = cleanData['Homeowner Name'] ? 
      cleanData['Homeowner Name'].replace(/[^a-zA-Z0-9]/g, '') : 
      'TurnIn';
    const fileName = `Gates_TurnIn_${homeownerName}_${timestamp}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    
    // Save PDF to disk
    fs.writeFileSync(filePath, pdfBuffer);
    
    // Generate public URL - with fixed URL construction
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const pdfUrl = `${baseUrl}/uploads/${fileName}`;
    
    console.log(`PDF generated and saved at: ${pdfUrl}`);
    
    // Send email notification if configured
    if (process.env.ENABLE_EMAIL === 'true' && cleanData['Homeowner Email']) {
      await sendEmailNotification(cleanData, pdfUrl, pdfBuffer, fileName);
      console.log('Email notification sent');
    }
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'PDF generated successfully',
      pdfUrl: pdfUrl
    });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF',
      error: error.message
    });
  }
});

// Function to extract field values from JotForm's complex structure
function extractFormFields(formData) {
  const cleanData = {};
  
  // Loop through all fields
  for (const key in formData) {
    // Check if field is a JotForm field (usually starts with q followed by numbers)
    if (key.match(/^q\d+/)) {
      const fieldValue = formData[key];
      
      // Get a cleaner field name by removing the q123_ prefix
      let cleanFieldName = key.replace(/^q\d+_/, '');
      
      // Handle complex nested fields
      if (typeof fieldValue === 'object' && fieldValue !== null) {
        // If field contains first/last name structure
        if (fieldValue.first || fieldValue.last) {
          cleanData[cleanFieldName + ' First'] = fieldValue.first || '';
          cleanData[cleanFieldName + ' Last'] = fieldValue.last || '';
          cleanData[cleanFieldName] = (fieldValue.first || '') + ' ' + (fieldValue.last || '');
        } else {
          // For other object types, add individual properties
          for (const subKey in fieldValue) {
            cleanData[cleanFieldName + ' ' + subKey] = fieldValue[subKey];
          }
          // Also add the entire object as is
          cleanData[cleanFieldName] = fieldValue;
        }
      } else {
        // Simple field - just add it with the cleaner name
        cleanData[cleanFieldName] = fieldValue;
      }
      
      // Also store under original key for compatibility
      cleanData[key] = fieldValue;
    } else {
      // For non-question fields like formID, keep them as is
      cleanData[key] = formData[key];
    }
  }
  
  // Map common field names to standardized names for the PDF template
  // Adjust these mappings based on your actual form field names
  const fieldMappings = {
    'projectManager': 'Project Manager',
    'yourName': 'Homeowner Name',
    'homeownerPhoneNumber': 'Homeowner Phone Number',
    'yourEmail': 'Homeowner Email',
    'email': 'Homeowner Email',
    'projectAddress': 'Project Address',
    'address': 'Project Address'
  };
  
  // Apply mappings
  for (const originalName in fieldMappings) {
    if (cleanData[originalName] !== undefined) {
      cleanData[fieldMappings[originalName]] = cleanData[originalName];
    }
  }
  
  return cleanData;
}

// Function to generate PDF using html-pdf
async function generatePDF(data) {
  console.log('Generating PDF with html-pdf');
  
  // Generate HTML content from template
  const htmlContent = generateTemplate(data);
  
  // PDF options
  const options = {
    format: 'A4',
    border: {
      top: '0.5cm',
      right: '0.5cm',
      bottom: '0.5cm',
      left: '0.5cm'
    },
    header: {
      height: '1cm'
    },
    footer: {
      height: '1cm'
    },
    renderDelay: 1000
  };
  
  // Generate PDF
  return new Promise((resolve, reject) => {
    pdf.create(htmlContent, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('PDF generation error:', err);
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
}

// Function to send email notification
async function sendEmailNotification(data, pdfUrl, pdfBuffer, fileName) {
  // Configure email transport
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  // Recipient email
  const recipient = process.env.NOTIFICATION_EMAIL || data['Homeowner Email'];
  
  // Create subject and body
  const homeownerName = data['Homeowner Name'] || 'Homeowner';
  const subject = `New Turn-In Document - ${homeownerName}`;
  
  const body = `A new Turn-In document has been generated for ${homeownerName}.\n\n` +
    `You can view and download the PDF using this link:\n${pdfUrl}\n\n` +
    `Project Address: ${data['Project Address'] || 'Not specified'}\n` +
    `Status: ${data['Status'] || 'Not specified'}\n\n` +
    `This is an automated notification.`;
  
  // Send email
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"PDF Generator" <noreply@example.com>',
    to: recipient,
    subject: subject,
    text: body,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer
      }
    ]
  });
}

// Add a route to list all generated PDFs
app.get('/pdfs', (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading uploads directory');
    }
    
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    
    let html = `
      <html>
        <head>
          <title>Generated PDFs</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #062841; }
            ul { list-style-type: none; padding: 0; }
            li { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            a { color: #0366d6; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>Generated PDFs</h1>
    `;
    
    if (pdfFiles.length === 0) {
      html += '<p>No PDFs generated yet</p>';
    } else {
      html += '<ul>';
      pdfFiles.forEach(file => {
        const fileUrl = `${baseUrl}/uploads/${file}`;
        const fileName = file.replace('Gates_TurnIn_', '').replace(/_.+\.pdf$/, '');
        const date = new Date(parseInt(file.split('_').pop().replace('.pdf', ''))).toLocaleString();
        
        html += `
          <li>
            <strong>${fileName}</strong><br>
            Generated: ${date}<br>
            <a href="${fileUrl}" target="_blank">View PDF</a>
          </li>
        `;
      });
      html += '</ul>';
    }
    
    html += '</body></html>';
    res.send(html);
  });
});

// Add a route to view generated PDFs
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

// Clean up old files periodically (optional but recommended for free tier)
function cleanupOldFiles() {
  const maxAgeInHours = 24; // Keep files for 24 hours
  
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return console.log('Error reading uploads directory:', err);
    
    const now = new Date().getTime();
    
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      
      fs.stat(filePath, (err, stats) => {
        if (err) return console.log(`Error getting stats for file ${file}:`, err);
        
        const fileAge = now - stats.mtime.getTime();
        const maxAge = maxAgeInHours * 60 * 60 * 1000;
        
        if (fileAge > maxAge) {
          fs.unlink(filePath, err => {
            if (err) return console.log(`Error deleting file ${file}:`, err);
            console.log(`Deleted old file: ${file}`);
          });
        }
      });
    });
  });
}

// Run cleanup every 12 hours
setInterval(cleanupOldFiles, 12 * 60 * 60 * 1000);

// Start the server
app.listen(PORT, () => {
  console.log(`PDF Generator service running on port ${PORT}`);
});

module.exports = app;
