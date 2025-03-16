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

// Middleware - IMPORTANT: Use urlencoded for JotForm webhooks
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
    // Log all request data for debugging
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Request query:', req.query);
    console.log('Request params:', req.params);
    
    // Get the submissionID and rawRequest from the POST data
    // JotForm sends data as POST parameters, which Express puts in req.body
    const submissionID = req.body.submissionID || '';
    const rawRequestStr = req.body.rawRequest || '{}';
    
    console.log('Submission ID:', submissionID);
    console.log('Raw request string:', rawRequestStr);
    
    // Parse the rawRequest JSON string to get the form data
    let formData = {};
    try {
      formData = JSON.parse(rawRequestStr);
      console.log('Successfully parsed form data:', formData);
    } catch (error) {
      console.error('Error parsing form data JSON:', error);
      // If parsing fails, try to use the rawRequest as is
      formData = rawRequestStr;
    }
    
    // Log all form field names for debugging
    console.log('Available form fields:', Object.keys(formData));
    
    // Extract field values for PDF generation
    const extractedData = extractFormFields(formData);
    console.log('Extracted data for PDF:', extractedData);
    
    // Generate PDF
    const pdfBuffer = await generatePDF(extractedData);
    
    // Create filename
    const timestamp = new Date().getTime();
    const homeownerName = extractedData['Homeowner Name'] ? 
      extractedData['Homeowner Name'].replace(/[^a-zA-Z0-9]/g, '') : 
      'TurnIn';
    const fileName = `Gates_TurnIn_${homeownerName}_${timestamp}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    
    // Save PDF to disk
    fs.writeFileSync(filePath, pdfBuffer);
    
    // Generate public URL - with fixed URL construction
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    // Make sure we're not including 'webhook' in the path
    const pdfUrl = `${baseUrl}/uploads/${fileName}`;
    
    console.log(`PDF generated and saved at: ${pdfUrl}`);
    
    // Send email notification if configured
    if (process.env.ENABLE_EMAIL === 'true' && extractedData['Homeowner Email']) {
      await sendEmailNotification(extractedData, pdfUrl, pdfBuffer, fileName);
      console.log('Email notification sent');
    }
    
    // Return success
    res.status(200).send("PDF generated successfully");
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error generating PDF: ' + error.message);
  }
});

// Function to extract field values from JotForm's field format
function extractFormFields(formData) {
  const extractedData = {};
  
  // Go through all form fields
  for (const key in formData) {
    const value = formData[key];
    
    // Handle name fields which have first/last as objects
    if (key.includes('_yourName') || key.includes('_name') || key.includes('_fullName')) {
      if (value && typeof value === 'object' && (value.first || value.last)) {
        const fullName = `${value.first || ''} ${value.last || ''}`.trim();
        extractedData['Homeowner Name'] = fullName;
        extractedData['Homeowner First Name'] = value.first || '';
        extractedData['Homeowner Last Name'] = value.last || '';
      } else {
        extractedData['Homeowner Name'] = value || '';
      }
    }
    // Handle email fields
    else if (key.includes('_email') || key.includes('_yourEmail')) {
      extractedData['Homeowner Email'] = value || '';
      extractedData['Homeowner Email (PLEASE INCLUDE THIS)'] = value || '';
    }
    // Handle phone number fields
    else if (key.includes('_phone') || key.includes('_phoneNumber')) {
      extractedData['Homeowner Phone Number'] = value || '';
    }
    // Handle address fields
    else if (key.includes('_address') || key.includes('_projectAddress')) {
      if (value && typeof value === 'object') {
        // Handle JotForm address fields which can be complex objects
        const addressParts = [];
        if (value.addr_line1) addressParts.push(value.addr_line1);
        if (value.addr_line2) addressParts.push(value.addr_line2);
        if (value.city) addressParts.push(value.city);
        if (value.state) addressParts.push(value.state);
        if (value.postal) addressParts.push(value.postal);
        
        extractedData['Project Address'] = addressParts.join(', ');
      } else {
        extractedData['Project Address'] = value || '';
      }
    }
    // Handle project manager fields
    else if (key.includes('_projectManager') || key.includes('_pmName')) {
      extractedData['Project Manager'] = value || '';
      extractedData['projectManager'] = value || '';
    }
    // Handle PM email fields
    else if (key.includes('_pmEmail')) {
      extractedData['PM Email'] = value || '';
    }
    
    // Save field with original name as well
    extractedData[key] = value;
    
    // Save field with cleaner name (without q123_ prefix)
    const cleanKey = key.replace(/^q\d+_/, '');
    if (cleanKey !== key) {
      extractedData[cleanKey] = value;
    }
  }
  
  return extractedData;
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
