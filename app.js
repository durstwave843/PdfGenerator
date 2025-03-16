// app.js - Main application file
const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { generateTemplate } = require('./templateGenerator');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/', (req, res) => {
  res.send('PDF Generator Service is running');
});

// Main webhook endpoint for JotForm
app.post('/webhook', async (req, res) => {
  console.log('Received webhook data');
  
  try {
    // Extract form data from JotForm webhook payload
    // JotForm sends data in a specific format we need to parse
    const formData = parseJotFormData(req.body);
    
    if (!formData) {
      return res.status(400).send('Invalid form data');
    }
    
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
    
    // Generate public URL (depends on your hosting)
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

// Function to generate PDF using puppeteer
async function generatePDF(data) {
  console.log('Launching browser for PDF generation');
  
  // Launch headless browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Generate HTML content from template
    const htmlContent = generateTemplate(data);
    
    // Set content to page
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5cm',
        right: '0.5cm',
        bottom: '0.5cm',
        left: '0.5cm'
      }
    });
    
    return pdfBuffer;
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
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
  
  // If the data is directly sent without wrapper
  return webhookData;
}

// Start the server
app.listen(PORT, () => {
  console.log(`PDF Generator service running on port ${PORT}`);
});

module.exports = app;
