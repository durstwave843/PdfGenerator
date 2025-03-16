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
    // Log raw data
    console.log('Raw webhook data:', JSON.stringify(req.body, null, 2));
    
    // Extract form data from JotForm webhook payload
    const formData = parseJotFormData(req.body);
    
    if (!formData) {
      return res.status(400).send('Invalid form data');
    }
    
    // Log field names and values for debugging
    console.log('Available fields:', Object.keys(formData));
    console.log('Project Manager field value:', formData['projectManager']);
    console.log('Processing submission for: ' + (formData['Homeowner Name'] || 'Unknown'));
    
    // Generate PDF
    const pdfBuffer = await generatePDF(formData);
    
    // Create filename
    const timestamp = new Date().getTime();
    const homeownerName = formData['Homeowner Name'] ? 
      formData['Homeowner Name'].replace(/[^a-zA-Z0-9]/g, '') : 
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
    if (process.env.ENABLE_EMAIL === 'true' && formData['Homeowner Email (PLEASE INCLUDE THIS)']) {
      await sendEmailNotification(formData, pdfUrl, pdfBuffer, fileName);
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
  const recipient = process.env.NOTIFICATION_EMAIL || data['Homeowner Email (PLEASE INCLUDE THIS)'];
  
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

// Helper function to parse JotForm data
function parseJotFormData(webhookData) {
  // JotForm webhook sends data with formData object or rawRequest object
  // We need to convert it to match our expected format
  
  // If it's raw request format 
  if (webhookData.rawRequest) {
    let formData = {};
    
    // Convert JotForm's format to our format
    for (const key in webhookData.rawRequest) {
      // Remove label prefixes JotForm adds (like "q1_homeownerName:")
      const cleanKey = key.includes('_') ? key.split('_').slice(1).join('_') : key;
      formData[cleanKey] = webhookData.rawRequest[key];
    }
    
    return formData;
  }
  
  // If it's already in formData format
  if (webhookData.formData) {
    return webhookData.formData;
  }
  
  // Enhanced parsing for direct webhook data
  // This handles cases where JotForm sends the data directly
  if (webhookData.q135_projectManager) {
    // Convert the data to our expected format
    let formData = {};
    for (const key in webhookData) {
      if (key.startsWith('q') && key.includes('_')) {
        // Extract the field name from the question key (e.g., q135_projectManager -> projectManager)
        const cleanKey = key.split('_').slice(1).join('_');
        formData[cleanKey] = webhookData[key];
        // Also keep a copy with the original field name for backward compatibility
        formData[key] = webhookData[key];
      } else {
        // Keep other fields as is
        formData[key] = webhookData[key];
      }
    }
    return formData;
  }
  
  // If the data is directly sent without wrapper
  return webhookData;
}

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
