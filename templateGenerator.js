// templateGenerator.js
// This module handles the HTML template generation

/**
 * Generate a UUID for document identification
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get a field value using multiple possible field names
 * This helps handle the various ways JotForm might send field data
 */
function getFieldValue(data, fieldOptions, defaultValue = '') {
  for (const field of fieldOptions) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      return data[field];
    }
  }
  return defaultValue;
}

/**
 * Generate HTML template with the form data
 */
function generateTemplate(data) {
  // Log all available fields for debugging
  console.log('Template generator received data with fields:', Object.keys(data));
  
  // Get various field values with multiple possible field names
  const projectManager = getFieldValue(
    data, 
    ['projectManager', '{projectManager}', 'q135_projectManager', 'Project Manager', 'PM Name'],
    'Project Manager'
  );
  
  const pmEmail = getFieldValue(
    data,
    ['pmEmail', '{pmEmail}', 'PM Email', 'Project Manager Email'],
    ''
  );
  
  const homeownerName = getFieldValue(
    data,
    ['Homeowner Name', 'homeownerName', 'homeowner'],
    'Homeowner'
  );
  
  const homeownerPhone = getFieldValue(
    data,
    ['Homeowner Phone Number', 'homeownerPhoneNumber', 'phone'],
    ''
  );
  
  const homeownerEmail = getFieldValue(
    data,
    ['Homeowner Email (PLEASE INCLUDE THIS)', 'homeownerEmail', 'email'],
    ''
  );
  
  const projectAddress = getFieldValue(
    data,
    ['Project Address', 'projectAddress', 'address'],
    ''
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gates Enterprises Turn In Document</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        .Contain {
            max-width: 8.5in;
            margin: 0 auto;
            font-family: Arial, Helvetica, sans-serif;
            font-weight: 900;
        }
        
        .header {
            position: relative;
            background-color: #062841;
            height: 3cm;
            font-family: Arial, Helvetica, sans-serif;
            border: 4px solid black;
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
        }
        
        .Date {
            font-size: 12px;
            color: white;
            padding-left: 20px;
            padding-top: 10px;
        }
        
        .border1 {
            border: 4px solid black;
            background-color: #4a4a4a;
            display: inline-block;
            width: 33.3333%;
            text-align: center;
            border-top: 0px;
            border-bottom-left-radius: 8px;
            border-right: 0px;
            color: white;
            padding: 5px 0;
        }
        
        .Homeowner {
            border: 4px solid black;
            border-left: 0cap;
            border-top: 0px;
            display: inline-block;
            padding-right: 115px;
            padding-left: 40px;
            border-bottom: 0px;
            width: calc(66.6667% - 159px);
        }
        
        .Phone {
            text-align: center;
            border: 4px solid black;
            border-top: 0;
            padding: 5px;
            font-weight: bold;
        }
        
        .Email {
            text-align: center;
            border: 4px solid black;
            border-top: 0;
            padding: 5px;
            font-weight: bold;
        }
        
        .sectionHeader {
            background-color: #062841;
            color: white;
            padding: 10px;
            margin-top: 20px;
            border-radius: 5px;
        }
        
        .projectDetails {
            margin-top: 20px;
            border: 2px solid #4a4a4a;
            padding: 10px;
            border-radius: 5px;
        }
        
        .detailsGrid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }
        
        .detailsRow {
            display: flex;
            margin-bottom: 10px;
        }
        
        .detailsLabel {
            font-weight: bold;
            width: 40%;
            background-color: #e9e9e9;
            padding: 8px;
            border-radius: 3px;
        }
        
        .detailsValue {
            width: 60%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
        }
        
        .structureSection {
            margin-top: 20px;
            border: 2px solid #4a4a4a;
            padding: 10px;
            border-radius: 5px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        
        th {
            background-color: #4a4a4a;
            color: white;
        }
        
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        
        .notes {
            margin-top: 20px;
            border: 2px solid #4a4a4a;
            padding: 10px;
            border-radius: 5px;
        }
        
        .notes p {
            white-space: pre-wrap;
        }
        
        .signature {
            margin-top: 30px;
            text-align: center;
        }
    </style>
</head>

<body>
    <div class="Contain">
        <!-- Using direct inline styling for critical elements -->
        <div style="position: relative; background-color: #062841 !important; height: 3cm; font-family: Arial, Helvetica, sans-serif; border: 4px solid black; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <div style="position: absolute; top: 5px; right: 20px; bottom: 20px; left: 0; background: url(https://gatesroof.com/public/uploads/1712815927.png) right/contain no-repeat; z-index: 1; background-size: 12% auto;"></div>
            
            <h1 style="font-size: 12px; color: white; padding-left: 20px; padding-top: 10px;">
                ${new Date().toLocaleDateString()}
            </h1>
            <h2 style="font-size: 25px; color: white; text-align: center; ">Turn in</h2>
            <h3 style="font-size: 20px; color: white; padding-left: 5px; font-weight: 800; position: relative; top: -40px; padding-left: 20px;">${projectManager}</h3>
            <h4 style="font-size: 12px; color: white; position: relative; top: -60px; padding-left: 20px;">${pmEmail}</h4>
        </div>
        
        <span style="border: 4px solid black; background-color: #4a4a4a !important; display: inline-block; width: 33.3333%; text-align: center; border-top: 0px; border-bottom-left-radius: 8px; border-right: 0px; color: white; padding: 5px 0;">Homeowner Contact:</span><span style="border: 4px solid black; border-left: 0cap; border-top: 0px; display: inline-block; padding-right: 115px; padding-left: 40px; border-bottom: 0px; width: calc(66.6667% - 159px);">${homeownerName}</span>
        
        ${homeownerPhone ? 
          `<div style="text-align: center; border: 4px solid black; border-top: 0; padding: 5px; font-weight: bold;">Phone Number: ${homeownerPhone}</div>` : ''}
        
        ${homeownerEmail ? 
          `<div style="text-align: center; border: 4px solid black; border-top: 0; padding: 5px; font-weight: bold;">Email: ${homeownerEmail}</div>` : ''}
        
        ${projectAddress ? 
          `<div style="text-align: center; border: 4px solid black; border-top: 0; padding: 5px; font-weight: bold;">Address: ${projectAddress}</div>` : ''}
        
        <!-- Roofing Details Section -->
        <div style="background-color: #062841 !important; color: white !important; padding: 10px !important; margin-top: 20px !important; border-radius: 5px !important;">
            <h3 style="margin: 0; color: white !important;">Roofing Materials & Details</h3>
        </div>
        
        <div class="projectDetails">
            <div class="detailsGrid">
                ${getFieldValue(data, ['What brand of shingle?', 'brandOfShingle'], '') ? 
                  `<div class="detailsRow">
                      <div class="detailsLabel">Brand of Shingle:</div>
                      <div class="detailsValue">${getFieldValue(data, ['What brand of shingle?', 'brandOfShingle'], '')}</div>
                  </div>` : ''}
                
                ${getFieldValue(data, ['What type of shingle?', 'typeOfShingle'], '') ? 
                  `<div class="detailsRow">
                      <div class="detailsLabel">Type of Shingle:</div>
                      <div class="detailsValue">${getFieldValue(data, ['What type of shingle?', 'typeOfShingle'], '')}</div>
                  </div>` : ''}
                
                ${getFieldValue(data, ['What color (must be actual color)', 'shingleColor'], '') ? 
                  `<div class="detailsRow">
                      <div class="detailsLabel">Shingle Color:</div>
                      <div class="detailsValue">${getFieldValue(data, ['What color (must be actual color)', 'shingleColor'], '')}</div>
                  </div>` : ''}
                
                ${getFieldValue(data, ['Drip edge color (circle)', 'dripEdgeColor'], '') ? 
                  `<div class="detailsRow">
                      <div class="detailsLabel">Drip Edge Color:</div>
                      <div class="detailsValue">${getFieldValue(data, ['Drip edge color (circle)', 'dripEdgeColor'], '')}</div>
                  </div>` : ''}
                
                ${getFieldValue(data, ['Ridge Type (circle)', 'ridgeType'], '') ? 
                  `<div class="detailsRow">
                      <div class="detailsLabel">Ridge Type:</div>
                      <div class="detailsValue">${getFieldValue(data, ['Ridge Type (circle)', 'ridgeType'], '')}</div>
                  </div>` : ''}
                
                ${getFieldValue(data, ['What roof materials are we replacing?', 'roofMaterials'], '') ? 
                  `<div class="detailsRow">
                      <div class="detailsLabel">Roof Materials to Replace:</div>
                      <div class="detailsValue">${getFieldValue(data, ['What roof materials are we replacing?', 'roofMaterials'], '')}</div>
                  </div>` : ''}
            </div>
        </div>
        
        <!-- Structure Details Section -->
        <div style="background-color: #062841 !important; color: white !important; padding: 10px !important; margin-top: 20px !important; border-radius: 5px !important;">
            <h3 style="margin: 0; color: white !important;">Structure Details</h3>
        </div>
        
        <div class="structureSection">
            <table>
                <tr>
                    <th>Structure</th>
                    <th>Roof</th>
                    <th>Gutters</th>
                    <th>Windows</th>
                    <th>Paint</th>
                </tr>
                <tr>
                    <td>House</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> House >> Roof', 'houseRoof'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> House >> Gutters', 'houseGutters'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> House >> Windows', 'houseWindows'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> House >> Paint', 'housePaint'], false) ? '✓' : '—'}</td>
                </tr>
                <tr>
                    <td>Shed</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Shed >> Roof', 'shedRoof'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Shed >> Gutters', 'shedGutters'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Shed >> Windows', 'shedWindows'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Shed >> Paint', 'shedPaint'], false) ? '✓' : '—'}</td>
                </tr>
                <tr>
                    <td>Garage</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Garage >> Roof', 'garageRoof'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Garage >> Gutters', 'garageGutters'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Garage >> Windows', 'garageWindows'], false) ? '✓' : '—'}</td>
                    <td>${getFieldValue(data, ['Structures to be worked on >> Garage >> Paint', 'garagePaint'], false) ? '✓' : '—'}</td>
                </tr>
            </table>
        </div>
        
        <!-- Notes Section -->
        ${(getFieldValue(data, ['Special instructions/notes/side deals', 'specialInstructions'], '') || 
           getFieldValue(data, ['Put any other important build notes here', 'buildNotes'], '')) ? 
          `<div style="background-color: #062841 !important; color: white !important; padding: 10px !important; margin-top: 20px !important; border-radius: 5px !important;">
              <h3 style="margin: 0; color: white !important;">Special Instructions & Notes</h3>
          </div>
          
          <div class="notes">
              ${getFieldValue(data, ['Special instructions/notes/side deals', 'specialInstructions'], '') ? 
                `<p><strong>Special Instructions:</strong><br>${getFieldValue(data, ['Special instructions/notes/side deals', 'specialInstructions'], '')}</p>` : ''}
              
              ${getFieldValue(data, ['Put any other important build notes here', 'buildNotes'], '') ? 
                `<p><strong>Additional Build Notes:</strong><br>${getFieldValue(data, ['Put any other important build notes here', 'buildNotes'], '')}</p>` : ''}
          </div>` : ''}
        
        <!-- Status and Certification -->
        <div style="background-color: #062841 !important; color: white !important; padding: 10px !important; margin-top: 20px !important; border-radius: 5px !important;">
            <h3 style="margin: 0; color: white !important;">Status and Certification</h3>
        </div>
        
        <div class="projectDetails">
            ${getFieldValue(data, ['Status', 'status'], '') ? 
              `<div style="margin-bottom: 15px;">
                  <strong>Current Status:</strong> ${getFieldValue(data, ['Status', 'status'], '')}
              </div>` : ''}
        </div>
        
        <div class="signature">
            <p style="border-top: 1px solid #000; display: inline-block; padding-top: 10px; min-width: 250px;">
                Project Manager Signature
            </p>
        </div>
        
        <div class="signature">
            <p style="border-top: 1px solid #000; display: inline-block; padding-top: 10px; min-width: 250px;">
                Date
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #666;">
            Document ID: ${generateUUID()}<br>
            Generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
}

module.exports = { generateTemplate, getFieldValue };
