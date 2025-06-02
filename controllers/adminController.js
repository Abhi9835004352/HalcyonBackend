const User = require('../models/userModel');
const Registration = require('../models/registrationModel');
const Event = require('../models/eventModel');
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');
const Excel = require('exceljs');
const mongoose = require('mongoose');
const { sendRegistrationEmail } = require('../utils/mailer');
const imagePath = path.join(__dirname, '../resources/image.png');
let imageBase64 = '';

// Define EVENT_CATEGORIES constant for use in Excel exports
const EVENT_CATEGORIES = [
  { id: 'dance', label: 'Dance', icon: 'fas fa-walking' },
  { id: 'music', label: 'Music', icon: 'fas fa-guitar' },
  { id: 'gaming', label: 'Gaming', icon: 'fas fa-gamepad' },
  { id: 'theatre', label: 'Theatre', icon: 'fas fa-theater-masks' },
  { id: 'finearts', label: 'Fine Arts', icon: 'fas fa-paint-brush' },
  { id: 'literary', label: 'Literary', icon: 'fas fa-book' },
  { id: 'other', label: 'Other', icon: 'fas fa-star' }
];

const getAllUsers = async (req, res) => {
  try {
    // Remove pagination and get all users
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    const total = users.length;

    res.json({
      users,
      total
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: err.message });
  }
};
const getAllRegistrations = async (req, res) => {
  try {
    // Optional: Add filtering by event or date
    const { eventId, startDate, endDate } = req.query;
    let filter = {};

    if (eventId) {
      filter.event = eventId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const registrations = await Registration.find(filter)
      .populate('event', 'name date venue category day fees')
      .populate('teamLeader', 'name email mobile transactionId')
      .populate('spotRegistration', 'name email mobile')
      .populate('teamMembers', 'name mobile email')
      .sort({ registeredAt: -1 }); // Sort by registration date, newest first

    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: "No registrations found" });
    }

    // Process registrations to add display information for spot registrations
    const processedRegistrations = registrations.map(reg => {
      const regObj = reg.toObject();

      // For spot registrations, use the participant's information from teamLeaderDetails
      if (regObj.spotRegistration && regObj.teamLeaderDetails) {
        regObj.displayTeamLeader = {
          name: regObj.teamLeaderDetails.name || 'Unknown Participant',
          email: regObj.teamLeaderDetails.email || 'N/A',
          mobile: regObj.teamLeaderDetails.mobile || 'N/A',
          usn: regObj.teamLeaderDetails.usn || 'N/A'
        };
        regObj.isSpotRegistration = true;
      } else {
        regObj.isSpotRegistration = false;
      }

      return regObj;
    });

    res.json(processedRegistrations);
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ error: err.message });
  }
}

const assignTeamMember = async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.managedBy = userId;
    await event.save();
    res.json({ message: "Team member assigned to event" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const generateJudgePdf = async (req, res) => {
  try {
    console.log('Judge PDF generation started for event');
    console.log('Note: Updated for production environment compatibility - fixed alignment issues');
    const { eventID } = req.params;
    const event = await Event.findById(eventID);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Get registrations with participant details
    const registrations = await Registration.find({ event: eventID })
      .populate('teamLeader', 'name email mobile')
      .populate('teamMembers', 'name email mobile usn')
      .populate('teamLeaderDetails', 'name usn collegeName')
      .populate('event', 'name date venue category day fees')
      .lean();

    console.log(`Found ${registrations.length} registrations for judge PDF`);

    // Read and encode the logos as base64 FIRST (before using them in template)
    const sitLogoPath = path.join(__dirname, '../resources/images/sit_logo-removebg-preview.png');
    const halcyonLogoPath = path.join(__dirname, '../resources/images/final LOGO.png');

    let sitLogoBase64 = '';
    let halcyonLogoBase64 = '';

    try {
      const sitLogoBuffer = fs.readFileSync(sitLogoPath);
      sitLogoBase64 = `data:image/png;base64,${sitLogoBuffer.toString('base64')}`;

      const halcyonLogoBuffer = fs.readFileSync(halcyonLogoPath);
      halcyonLogoBase64 = `data:image/png;base64,${halcyonLogoBuffer.toString('base64')}`;
    } catch (err) {
      console.error('Error reading logo files:', err);
    }

    // Read the judging HTML template
    const judgingTemplatePath = path.join(__dirname, '../templates/juding.html');
    let html = fs.readFileSync(judgingTemplatePath, 'utf8');

    console.log('Judge PDF: Starting template processing...');

    // Replace the event name in the template
    html = html.replace('Event: <strong>&nbsp;</strong>', `Event: ${event.name}`);
    html = html.replace('Event: <strong></strong>', `Event: ${event.name}`);

    // Fix alignment issues by adjusting margins and positioning to match the desired layout
    html = html.replace('margin-left:-41.15pt;', 'margin-left:0pt;');
    html = html.replace('margin-left:-49.45pt;', 'margin-left:0pt;');
    html = html.replace('text-indent:135.75pt;', 'text-indent:0pt; text-align:center;');

    // Update the main title structure to match the desired format
    // Replace the existing logo and title line to match the image layout
    html = html.replace(
      /<p class="MsoNormal" style="margin-top:0in;margin-right:0in;margin-bottom:0in; margin-left:-41\.15pt;"><img[^>]*><span[^>]*>&nbsp;<\/span> <strong><span style='font-size:52\.0pt;line-height:107%;font-family:"Times New Roman",serif;'>HALCYON<\/span><\/strong> <strong><span style='font-size:57\.0pt;line-height:107%;font-family:"Times New Roman",serif;'>2025<\/span><\/strong><\/p>/g,
      `<div style="display: flex; align-items: center; margin: 10pt 0;">
         <img width="101" height="99" src="${sitLogoBase64}" alt="SIT Logo" style="margin-right: 20pt;">
         <h1 style="font-size: 52pt; font-family: 'Times New Roman', serif; font-weight: bold; margin: 0; text-align: center; flex-grow: 1;">HALCYON 2025</h1>
       </div>`
    );

    // Update the header structure to match the desired format
    // Replace the existing header paragraph with proper structure
    html = html.replace(
      /<p class="MsoNormal" style="margin-top:0in;margin-right:64\.65pt;margin-bottom: 0in;margin-left:0in;text-indent:135\.75pt;"><strong><u><span style='font-size:20\.0pt; line-height:107%;font-family:"Times New Roman",serif;'>Judging parameters<\/span><\/u><\/strong> <span style='font-size:20\.0pt;line-height:107%;font-family:"Times New Roman",serif;'>Event: <strong>&nbsp;<\/strong><\/span><\/p>/g,
      `<p class="MsoNormal" style="margin:5pt 0; text-align:center;"><strong><u><span style='font-size:20.0pt; line-height:107%;font-family:"Times New Roman",serif;'>Judging parameters</span></u></strong></p>
       <p class="MsoNormal" style="margin:10pt 0 15pt 0;"><span style='font-size:16.0pt;line-height:107%;font-family:"Times New Roman",serif;'>Event: ${event.name}</span></p>`
    );

    // Replace the existing base64 image with the SIT logo (left side only)
    const existingImageRegex = /src="data:image\/[^"]+"/g;
    html = html.replace(existingImageRegex, `src="${sitLogoBase64}"`);
    console.log('Judge PDF: Replaced logo with SIT logo');

    // Update the header layout to match the desired format exactly
    // Replace the entire header section with the correct structure
    html = html.replace(
      /<p class="MsoNormal" style="[^"]*"><img[^>]*><span[^>]*>&nbsp;<\/span> <strong><span[^>]*>HALCYON<\/span><\/strong> <strong><span[^>]*>2025<\/span><\/strong><\/p>/g,
      `<div style="display: table; width: 100%; margin: 10pt 0;">
         <div style="display: table-cell; vertical-align: middle; width: 120px;">
           <img width="101" height="99" src="${sitLogoBase64}" alt="SIT Logo">
         </div>
         <div style="display: table-cell; vertical-align: middle; text-align: center;">
           <h1 style="font-size: 48pt; font-family: 'Times New Roman', serif; font-weight: bold; margin: 0;">HALCYON 2025</h1>
         </div>
       </div>`
    );

    // Remove all watermarks completely - multiple patterns
    const beforeWatermarkRemoval = html.length;
    html = html.replace(/<p style="bottom: 10px; right: 10px; position: absolute;">.*?<\/p>/gi, '');
    html = html.replace(/<p[^>]*position:\s*absolute[^>]*>.*?<\/p>/gi, '');
    html = html.replace(/<a[^>]*wordtohtml[^>]*>.*?<\/a>/gi, '');
    html = html.replace(/Converted to HTML with WordToHTML\.net/gi, '');
    html = html.replace(/<[^>]*watermark[^>]*>.*?<\/[^>]*>/gi, '');
    html = html.replace(/opacity:\s*0\.[0-9]+/gi, 'opacity: 1');
    html = html.replace(/background-image:[^;]+;/gi, '');
    const afterWatermarkRemoval = html.length;
    console.log(`Judge PDF: Watermark removal - before: ${beforeWatermarkRemoval}, after: ${afterWatermarkRemoval}`);

    // Remove any additional logos that might be added (ensure only left logo remains)
    // Count images and remove any after the first one
    const imageMatches = html.match(/<img[^>]*>/g);
    console.log(`Judge PDF: Found ${imageMatches ? imageMatches.length : 0} images in template`);
    if (imageMatches && imageMatches.length > 1) {
      // Keep only the first image (SIT logo), remove others
      let imageCount = 0;
      html = html.replace(/<img[^>]*>/g, (match) => {
        imageCount++;
        return imageCount === 1 ? match : '';
      });
      console.log('Judge PDF: Removed additional logos, keeping only SIT logo');
    }

    // Fix page break issues - reduce excessive spacing that causes table to move to next page
    html = html.replace(/margin-bottom:48\.15pt;/g, 'margin-bottom:6pt;');
    html = html.replace(/margin-bottom:9\.9pt;/g, 'margin-bottom:3pt;');
    html = html.replace(/margin-bottom:0in;/g, 'margin-bottom:0pt;');

    // Remove excessive top margins and spacing
    html = html.replace(/margin-top:0in;margin-right:0in;margin-bottom:0in; margin-left:-41\.15pt;/g, 'margin:0; padding:5pt;');
    html = html.replace(/margin-top:0in;margin-right:64\.65pt;margin-bottom: 0in;margin-left:0in;text-indent:135\.75pt;/g, 'margin:5pt 0; text-align:center;');

    // Fix table positioning to start immediately after header
    html = html.replace(/margin-left:-49\.45pt;/g, 'margin-left:0pt; margin-top:5pt;');

    // Add CSS to prevent page breaks within table rows and maintain table structure
    const pageBreakCSS = `
      <style>
        body {
          margin: 0;
          padding: 10px;
          font-size: 12pt;
        }
        .WordSection1 {
          margin: 0;
          padding: 10px;
        }
        p {
          margin: 2pt 0;
          padding: 0;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .WordSection1 {
            margin: 0;
            padding: 20px;
          }
          table {
            page-break-inside: avoid;
            table-layout: fixed;
            width: 100%;
            border-collapse: collapse;
            margin-top: 10pt;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          td {
            page-break-inside: avoid;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          .TableGrid {
            page-break-inside: avoid;
            table-layout: fixed;
            width: 100%;
            margin-top: 10pt;
          }
        }
        table {
          page-break-inside: avoid;
          table-layout: fixed;
          width: 100%;
          border-collapse: collapse;
          margin-top: 10pt;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        td {
          page-break-inside: avoid;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .TableGrid {
          page-break-inside: avoid;
          table-layout: fixed;
          width: 100%;
          margin-top: 10pt;
        }
      </style>
    `;

    // Insert CSS before the closing head tag or at the beginning of the document
    if (html.includes('</head>')) {
      html = html.replace('</head>', pageBreakCSS + '</head>');
    } else {
      html = pageBreakCSS + html;
    }

    // Update table attributes to prevent page breaks and match the header format
    html = html.replace(
      'class="TableGrid" border="0" cellspacing="0" cellpadding="0"',
      'class="TableGrid" border="1" cellspacing="0" cellpadding="0" style="page-break-inside: avoid; table-layout: fixed; width: 100%; border-collapse: collapse; border: 1pt solid black;"'
    );

    // Update table headers to match the exact format from the image
    // Replace the existing table header structure
    html = html.replace(
      /<tr[^>]*>\s*<td[^>]*>.*?Sl\. No\..*?<\/td>\s*<td[^>]*>.*?Name.*?<\/td>.*?<\/tr>/gs,
      `<tr style="height: 30pt;">
         <td style="width: 60px; border: 1pt solid black; padding: 5pt; text-align: center; font-weight: bold; background-color: #f0f0f0;">
           <p style="margin: 0; font-size: 12pt; font-family: 'Times New Roman', serif;">Sl. No.</p>
         </td>
         <td style="width: 200px; border: 1pt solid black; padding: 5pt; text-align: center; font-weight: bold; background-color: #f0f0f0;">
           <p style="margin: 0; font-size: 12pt; font-family: 'Times New Roman', serif;">Name</p>
         </td>
         <td style="width: 100px; border: 1pt solid black; padding: 5pt; text-align: center; font-weight: bold; background-color: #f0f0f0;">
           <p style="margin: 0; font-size: 12pt; font-family: 'Times New Roman', serif;">College code</p>
         </td>
         <td style="border: 1pt solid black; padding: 5pt; text-align: center; font-weight: bold; background-color: #f0f0f0;">
           <p style="margin: 0; font-size: 12pt; font-family: 'Times New Roman', serif;">Judging Parameters</p>
         </td>
         <td style="width: 80px; border: 1pt solid black; padding: 5pt; text-align: center; font-weight: bold; background-color: #f0f0f0;">
           <p style="margin: 0; font-size: 12pt; font-family: 'Times New Roman', serif;">Total</p>
         </td>
       </tr>`
    );

    // Create a complete HTML structure for judge PDF with proper alignment
    const judgeHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Judge Sheet - ${event.name}</title>
    <style>
        /* Reset and base styles for consistent rendering across environments */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Times New Roman', 'Times', serif;
            margin: 0;
            padding: 20px;
            color: #000;
            line-height: 1.2;
            font-size: 12pt;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* Header section with absolute positioning for consistent layout */
        .header-container {
            width: 100%;
            height: 120px;
            margin-bottom: 30px;
            position: relative;
            border: none;
        }

        .logo-left {
            position: absolute;
            left: 0;
            top: 0;
            width: 110px;
            height: 110px;
            display: block;
        }

        .title-text {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            font-size: 52pt;
            font-weight: bold;
            font-family: 'Times New Roman', 'Times', serif;
            margin: 0;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
        }

        .subtitle {
            text-align: center;
            margin: 20px 0 15px 0;
            font-size: 20pt;
            text-decoration: underline;
            font-weight: bold;
            font-family: 'Times New Roman', 'Times', serif;
        }

        .event-label {
            text-align: left;
            margin: 15px 0 25px 0;
            font-size: 16pt;
            font-weight: normal;
            font-family: 'Times New Roman', 'Times', serif;
        }

        /* Table styles with fixed layout for consistent rendering */
        .judge-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            table-layout: fixed;
            font-family: 'Times New Roman', 'Times', serif;
        }

        .judge-table th,
        .judge-table td {
            border: 1pt solid #000;
            padding: 6px 4px;
            text-align: center;
            vertical-align: middle;
            font-size: 10pt;
            word-wrap: break-word;
        }

        .judge-table th {
            font-weight: bold;
            font-size: 12pt;
            background-color: #f5f5f5;
        }

        /* Fixed column widths for consistent layout */
        .col-sl-no { width: 60px; }
        .col-name { width: 180px; text-align: left; }
        .col-college { width: 100px; }
        .col-param { width: 90px; }
        .col-total { width: 70px; }

        /* Print-specific styles */
        @media print {
            body {
                margin: 0;
                padding: 15px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .header-container {
                page-break-inside: avoid;
                height: 120px;
            }
            .judge-table {
                page-break-inside: avoid;
            }
        }

        /* Production environment compatibility */
        @page {
            margin: 0.5in;
            size: A4;
        }
    </style>
</head>
<body>
    <div class="header-container">
        <img class="logo-left" src="${sitLogoBase64}" alt="SIT Logo">
        <div class="title-text">HALCYON 2025</div>
    </div>

    <div class="subtitle">Judging parameters</div>

    <div class="event-label">Event: <strong>${event.name}</strong></div>

    <table class="judge-table">
        <thead>
            <tr>
                <th rowspan="2" class="col-sl-no">Sl. No.</th>
                <th rowspan="2" class="col-name">Name</th>
                <th rowspan="2" class="col-college">College code</th>
                <th colspan="5">Judging Parameters</th>
                <th rowspan="2" class="col-total">Total</th>
            </tr>
            <tr>
                <th class="col-param">&nbsp;</th>
                <th class="col-param">&nbsp;</th>
                <th class="col-param">&nbsp;</th>
                <th class="col-param">&nbsp;</th>
                <th class="col-param">&nbsp;</th>
            </tr>
        </thead>
        <tbody>
            ${registrations.map((reg, index) => {
              if (reg.teamMembers && reg.teamMembers.length > 0) {
                // For team events: Show "Team Name - Team Leader Name"
                const teamName = reg.teamName || 'Unnamed Team';
                const teamLeaderName = reg.isSpotRegistration
                  ? (reg.displayTeamLeader?.name || 'Unknown')
                  : (reg.teamLeader?.name || 'Unknown');
                const displayName = `${teamName} - ${teamLeaderName}`;

                return `
                  <tr>
                    <td class="col-sl-no">${index + 1}</td>
                    <td class="col-name">${displayName}</td>
                    <td class="col-college">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-total">&nbsp;</td>
                  </tr>`;
              } else {
                // For individual events: Show participant name only
                const participantName = reg.isSpotRegistration
                  ? (reg.displayTeamLeader?.name || 'Unknown')
                  : (reg.teamLeader?.name || 'Unknown');

                return `
                  <tr>
                    <td class="col-sl-no">${index + 1}</td>
                    <td class="col-name">${participantName}</td>
                    <td class="col-college">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-param">&nbsp;</td>
                    <td class="col-total">&nbsp;</td>
                  </tr>`;
              }
            }).join('')}
        </tbody>
    </table>
</body>
</html>`;

    console.log(`Judge PDF: Generated complete HTML with ${registrations.length} participants, serial numbers 1-${registrations.length}`);

    console.log('Judge PDF: Using custom HTML template, generating PDF...');

    const options = {
      format: "A4",
      orientation: "portrait",
      border: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in"
      },
      type: "pdf",
      quality: "100",
      height: "11.7in",
      width: "8.3in",
      // Additional options for production environment compatibility
      timeout: 30000,
      phantomPath: undefined, // Let html-pdf find PhantomJS automatically
      phantomArgs: [
        '--load-images=yes',
        '--local-to-remote-url-access=yes',
        '--web-security=no',
        '--ignore-ssl-errors=yes',
        '--ssl-protocol=any'
      ],
      // Rendering options for consistent output
      renderDelay: 1000,
      zoomFactor: 1.0,
      // Font rendering options
      dpi: 96,
      script: undefined
    };

    pdf.create(judgeHtml, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('Judge PDF generation error:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          phantomPath: options.phantomPath,
          environment: process.env.NODE_ENV || 'development'
        });
        return res.status(500).json({
          error: "Error generating judge PDF",
          details: process.env.NODE_ENV === 'development' ? err.message : 'PDF generation failed'
        });
      }
      console.log('Judge PDF generated successfully');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${event.name.replace(/\s+/g, '_')}_Judge_Sheet_${Date.now()}.pdf`);
      res.send(buffer);
    });
  } catch (err) {
    console.error('Error in generateJudgePdf:', err);
    res.status(500).json({ error: err.message });
  }
};

const generatePdf = async (req, res) => {
  try {
    console.log('PDF generation started for event');
    const { eventID } = req.params;
    const event = await Event.findById(eventID);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Get registrations with participant details
    const registrations = await Registration.find({ event: eventID })
      .populate('teamLeader', 'name email mobile')
      .populate('teamMembers', 'name email mobile usn')
      .populate('teamLeaderDetails', 'name usn collegeName')
      .populate('event', 'name date venue category day fees')
      .lean();

    // Convert logos to base64
    const sitLogoPath = path.join(__dirname, '../resources/images/sit_logo-removebg-preview.png');
    const finalLogoPath = path.join(__dirname, '../resources/images/final LOGO.png');

    let sitLogoBase64 = '';
    let finalLogoBase64 = '';

    try {
      const sitLogoBuffer = fs.readFileSync(sitLogoPath);
      sitLogoBase64 = `data:image/png;base64,${sitLogoBuffer.toString('base64')}`;
    } catch (error) {
      console.log('SIT logo not found, proceeding without left logo');
      sitLogoBase64 = '';
    }

    try {
      const finalLogoBuffer = fs.readFileSync(finalLogoPath);
      finalLogoBase64 = `data:image/png;base64,${finalLogoBuffer.toString('base64')}`;
    } catch (error) {
      console.log('Final logo not found, proceeding without right logo');
      finalLogoBase64 = '';
    }

    if (!registrations) return res.status(404).json({ error: "No registrations found" });

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Halcyon 2025 Registration Report</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            margin: 0;
            padding: 20px;
            color: #000;
            line-height: 1.2;
        }

        .WordSection1 {
            max-width: 800px;
            margin: 0 auto;
        }

        .MsoNormal {
            margin: 0;
            padding: 0;
        }

        .header-section {
            text-align: center;
            margin-bottom: 30px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .header-content {
            display: inline-block;
            vertical-align: top;
        }

        .logo-left {
            width: 93px;
            height: 98px;
            margin-right: 20px;
            vertical-align: middle;
        }

        .logo-right {
            width: 133px;
            height: 109px;
            margin-left: 20px;
            vertical-align: middle;
        }

        .title-text {
            font-size: 46pt;
            font-weight: bold;
            font-family: 'Times New Roman', serif;
            display: inline-block;
            vertical-align: middle;
            margin: 0 20px;
            line-height: 1;
        }

        .event-info {
            margin: 30px 0;
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
        }

        .registration-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12pt;
        }

        .registration-table th,
        .registration-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }

        .registration-table th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
        }

        .registration-table td:first-child {
            text-align: center;
            width: 60px;
        }

        .registration-table td:nth-child(2) {
            text-align: center;
            width: 100px;
        }

        .registration-table td:nth-child(3) {
            width: 200px;
        }

        .registration-table td:nth-child(4) {
            width: 150px;
        }

        .registration-table td:nth-child(5) {
            width: 120px;
        }

        .team-members-list {
            margin-top: 5px;
            font-size: 10pt;
            color: #555;
        }

        .team-member-item {
            margin: 2px 0;
            padding: 1px 0;
        }

        .member-name {
            font-weight: bold;
        }

        .member-usn {
            color: #666;
            font-style: italic;
        }

        .no-registrations {
            text-align: center;
            padding: 20px;
            font-style: italic;
            color: #666;
        }

        .footer-info {
            margin-top: 40px;
            text-align: center;
            font-size: 10pt;
            color: #666;
        }

        @media print {
            body {
                margin: 0;
                padding: 15px;
            }

            .WordSection1 {
                max-width: none;
            }
        }
    </style>
</head>
<body>
    <div class="WordSection1">
        <div class="header-section">
            <img class="logo-left" src="${sitLogoBase64}" alt="SIT Logo">
            <span class="title-text">HALCYON 2025</span>
            <img class="logo-right" src="${finalLogoBase64}" alt="Halcyon Logo">
        </div>

        <div class="event-info">
            ${event.name}
        </div>

        <table class="registration-table">
            <thead>
                <tr>
                    <th>Sl. No.</th>
                    <th>College Code</th>
                    <th>Name</th>
                    <th>USN</th>
                    <th>Contact No.</th>
                </tr>
            </thead>
            <tbody>
                ${registrations.length > 0 ?
                  (() => {
                    let teamIndex = 0;
                    return registrations.map((registration) => {
                      teamIndex++;
                      const rows = [];

                      // Get team leader details
                      const leaderName = registration.spotRegistration && registration.teamLeaderDetails?.name
                        ? registration.teamLeaderDetails.name
                        : registration.teamLeader?.name || 'N/A';
                      const leaderUSN = registration.teamLeaderDetails?.usn || 'N/A';
                      const leaderMobile = registration.teamLeader?.mobile || 'N/A';

                      // Check if this is a team event (has team members or team name)
                      const isTeamEvent = (registration.teamMembers && registration.teamMembers.length > 0) || registration.teamName;

                      if (isTeamEvent) {
                        // Add team name row with team leader name
                        rows.push(`
                          <tr style="font-weight: bold; background-color: #f8f9fa;">
                            <td>${teamIndex}</td>
                            <td></td>
                            <td>${registration.teamName || 'Team'} - ${leaderName} (Team Lead)</td>
                            <td></td>
                            <td></td>
                          </tr>`);

                        // Add team leader details
                        rows.push(`
                          <tr>
                            <td></td>
                            <td></td>
                            <td>${leaderName}</td>
                            <td>${leaderUSN}</td>
                            <td>${leaderMobile}</td>
                          </tr>`);

                        // Add team members if any
                        if (registration.teamMembers && registration.teamMembers.length > 0) {
                          registration.teamMembers.forEach(member => {
                            rows.push(`
                              <tr>
                                <td></td>
                                <td></td>
                                <td>${member.name || 'N/A'}</td>
                                <td>${member.usn || 'N/A'}</td>
                                <td>${member.mobile || 'N/A'}</td>
                              </tr>`);
                          });
                        }

                        // Add blank line after team
                        rows.push(`
                          <tr style="height: 20px;">
                            <td colspan="5" style="border: none; background-color: transparent;"></td>
                          </tr>`);
                      } else {
                        // Individual participant (not a team event)
                        rows.push(`
                          <tr>
                            <td>${teamIndex}</td>
                            <td></td>
                            <td>${leaderName}</td>
                            <td>${leaderUSN}</td>
                            <td>${leaderMobile}</td>
                          </tr>`);
                      }

                      return rows.join('');
                    }).join('');
                  })() :
                  `<tr><td colspan="5" class="no-registrations">No registrations found for this event</td></tr>`
                }
            </tbody>
        </table>

        <div class="footer-info">
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>© Halcyon 2025 - All rights reserved</p>
        </div>
    </div>
</body>
</html>
`;

    const options = {
      format: "A4",
      orientation: "portrait",
      border: {
        top: "0.5in",
        right: "0.5in",
        bottom: "0.5in",
        left: "0.5in"
      },
      type: "pdf",
      quality: "100",
    };
    pdf.create(html, options).toBuffer((err, buffer) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Error generating PDF" });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${event.name.replace(/\s+/g, '_')}_Registration_Report_${Date.now()}.pdf`);
      res.send(buffer);
    })
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

    // Check if event exists before deletion
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Delete the event using the non-deprecated method
    await Event.findByIdAndDelete(eventId);
    res.json({ message: `Event with Id ${eventId} deleted successfully` });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: err.message });
  }
}
const editEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
const exportRegistrationsToExcel = async (req, res) => {
  try {
    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    workbook.creator = 'Halcyon 2025';
    workbook.lastModifiedBy = 'Admin Dashboard';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Optional: Add filtering by event or date from query parameters
    const { eventId, startDate, endDate } = req.query;
    const query = {};

    if (eventId) {
      query.event = eventId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Fetch registrations with populated references
    const registrations = await Registration.find(query)
      .populate('event', 'name date venue category day fees')
      .populate('teamLeader', 'name email mobile')
      .populate('spotRegistration', 'name email mobile')
      .sort({ registeredAt: -1 }); // Sort by registration date, newest first

    if (registrations.length === 0) {
      return res.status(404).json({ error: "No registrations found" });
    }

    console.log(`Found ${registrations.length} registrations for Excel export`);

    // Create "All Registrations" worksheet
    const allRegistrationsWorksheet = workbook.addWorksheet('All Registrations');

    // Helper function to setup worksheet columns and styling
    const setupWorksheet = (worksheet) => {
      // Define columns
      worksheet.columns = [
        { header: 'Sl. No.', key: 'slNo', width: 8 },
        { header: 'Event Name', key: 'eventName', width: 25 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Day', key: 'day', width: 8 },
        { header: 'Team Name', key: 'teamName', width: 20 },
        { header: 'Team Size', key: 'teamSize', width: 10 },
        { header: 'Team Leader Name', key: 'leaderName', width: 20 },
        { header: 'Leader USN', key: 'leaderUsn', width: 15 },
        { header: 'Team Members (Name - USN)', key: 'teamMembers', width: 40 },
        { header: 'Email', key: 'leaderEmail', width: 25 },
        { header: 'Mobile', key: 'leaderMobile', width: 15 },
        { header: 'College', key: 'collegeName', width: 30 },
        { header: 'College Code', key: 'collegeCode', width: 15 },
        { header: 'Registration Date', key: 'registeredAt', width: 20 },
        { header: 'Payment Status', key: 'paymentStatus', width: 18 },
        { header: 'Payment Required', key: 'paymentRequired', width: 18 },
        { header: 'Payment ID', key: 'paymentId', width: 25 },
        { header: 'Transaction ID', key: 'transactionId', width: 25 },
        { header: 'Notes', key: 'notes', width: 30 }
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }
      };
      worksheet.getRow(1).font = {
        color: { argb: 'FFFFFFFF' },
        bold: true
      };
    };

    // Setup the "All Registrations" worksheet
    setupWorksheet(allRegistrationsWorksheet);

    // Helper function to add registration data to a worksheet
    const addRegistrationData = (worksheet, registrationsList, startIndex = 0) => {
      registrationsList.forEach((registration, index) => {
        // Get category name
        let categoryName = 'Unknown';
        if (registration.event && registration.event.category) {
          const category = EVENT_CATEGORIES.find(cat => cat.id === registration.event.category);
          categoryName = category ? category.label : 'Unknown';
        }

        // Check if this is a spot registration
        const isSpotRegistration = registration.spotRegistration !== null;

        // For spot registrations, use the participant information from teamLeaderDetails
        const participantName = isSpotRegistration && registration.teamLeaderDetails?.name
          ? registration.teamLeaderDetails.name
          : (registration.teamLeader ? registration.teamLeader.name : 'Unknown');

        const participantEmail = isSpotRegistration && registration.teamLeaderDetails?.email
          ? registration.teamLeaderDetails.email
          : (registration.teamLeader ? registration.teamLeader.email : 'N/A');

        const participantMobile = isSpotRegistration && registration.teamLeaderDetails?.mobile
          ? registration.teamLeaderDetails.mobile
          : (registration.teamLeader ? registration.teamLeader.mobile : 'N/A');

        // Extract team member info from payment ID for spot registrations
        let teamMemberName = '';
        if (isSpotRegistration && registration.spotRegistration) {
          teamMemberName = registration.spotRegistration.name || '';
        } else if (isSpotRegistration && registration.paymentId && registration.paymentId.includes('SPOT_PAYMENT_')) {
          // Try to extract team member name from payment ID format: SPOT_PAYMENT_TeamMemberName_Timestamp
          const paymentParts = registration.paymentId.split('_');
          if (paymentParts.length >= 3) {
            // The format should be ["SPOT", "PAYMENT", "TeamMemberName", "Timestamp"]
            // If the team member name has underscores, we need to join the parts
            teamMemberName = paymentParts.slice(2, -1).join('_');
          }
        }

        // Add a note for spot registrations
        const registrationNote = isSpotRegistration
          ? `Spot registration by ${teamMemberName || registration.spotRegistration?.name || 'team member'}`
          : '';

        // Determine payment requirement text for Excel
        const getPaymentRequiredText = (paymentStatus) => {
          switch (paymentStatus) {
            case 'not_required':
              return 'No';
            case 'pay_on_event_day':
              return 'Yes - On Event Day';
            case 'payment_required':
              return 'Yes - Advance Payment';
            case 'completed':
              return 'No - Already Paid';
            case 'pending':
              return 'Yes - Payment Pending';
            case 'failed':
              return 'Yes - Payment Failed';
            default:
              return 'Unknown';
          }
        };

        // Format team members for display
        let teamMembersText = '';
        if (registration.teamMembers && registration.teamMembers.length > 0) {
          teamMembersText = registration.teamMembers.map(member => {
            const memberName = member.name || 'N/A';
            const memberUsn = member.usn || 'N/A';
            return `${memberName} - ${memberUsn}`;
          }).join('; ');
        } else {
          teamMembersText = 'No additional members';
        }

        worksheet.addRow({
          slNo: startIndex + index + 1,
          eventName: registration.event ? registration.event.name : 'Unknown',
          category: categoryName,
          day: registration.event ? registration.event.day || 1 : 'N/A',
          teamName: registration.teamName || 'N/A',
          teamSize: registration.teamSize || 1,
          leaderName: participantName,
          leaderUsn: registration.teamLeaderDetails ? registration.teamLeaderDetails.usn : 'N/A',
          teamMembers: teamMembersText,
          leaderEmail: participantEmail,
          leaderMobile: participantMobile,
          collegeName: registration.teamLeaderDetails ? registration.teamLeaderDetails.collegeName : 'N/A',
          collegeCode: registration.collegeCode || 'N/A', // Include college code in Excel export
          registeredAt: registration.registeredAt ? new Date(registration.registeredAt).toLocaleString() : 'N/A',
          paymentStatus: registration.paymentStatus || 'N/A',
          paymentRequired: getPaymentRequiredText(registration.paymentStatus),
          paymentId: registration.paymentId || 'N/A',
          transactionId: registration.transactionId || 'N/A',
          notes: registrationNote
        });
      });
    };

    // Add data to "All Registrations" worksheet
    addRegistrationData(allRegistrationsWorksheet, registrations);

    // Create event-wise worksheets instead of category-wise
    // First, get all events from the database to ensure we include all events
    const Event = require('../models/eventModel');
    const allEvents = await Event.find({}).sort({ name: 1 }); // Sort by name

    // Group registrations by event
    const registrationsByEvent = {};

    // Initialize all events (even those without registrations)
    allEvents.forEach(event => {
      registrationsByEvent[event._id.toString()] = {
        eventName: event.name,
        eventData: event,
        registrations: []
      };
    });

    // Add registrations to their respective events
    registrations.forEach(registration => {
      if (registration.event && registration.event._id) {
        const eventId = registration.event._id.toString();
        if (registrationsByEvent[eventId]) {
          registrationsByEvent[eventId].registrations.push(registration);
        }
      }
    });

    // Create a worksheet for each event (including those without registrations)
    // Sort events by name for better organization
    const sortedEventIds = Object.keys(registrationsByEvent).sort((a, b) => {
      return registrationsByEvent[a].eventName.localeCompare(registrationsByEvent[b].eventName);
    });

    console.log(`Creating worksheets for ${sortedEventIds.length} events`);

    sortedEventIds.forEach((eventId, index) => {
      const eventInfo = registrationsByEvent[eventId];
      const eventRegistrations = eventInfo.registrations;
      const event = eventInfo.eventData;

      // Clean event name for worksheet name (Excel has restrictions on sheet names)
      let sheetName = eventInfo.eventName
        .replace(/[\\\/\?\*\[\]]/g, '') // Remove invalid characters
        .substring(0, 31); // Excel sheet names must be 31 characters or less

      // Ensure unique sheet names in case of duplicates
      let originalSheetName = sheetName;
      let counter = 1;
      while (workbook.worksheets.find(ws => ws.name === sheetName)) {
        sheetName = `${originalSheetName.substring(0, 28)}_${counter}`;
        counter++;
      }

      const eventWorksheet = workbook.addWorksheet(sheetName);
      setupWorksheet(eventWorksheet);

      // Add comprehensive event information as a note in cell A1
      const eventDetails = [
        `Event: ${event.name || 'N/A'}`,
        `Category: ${event.category || 'N/A'}`,
        `Day: ${event.day || 'N/A'}`,
        `Fees: ₹${event.fees || 0}`,
        `Team Size: ${event.teamSize || 1}`,
        `Registration Status: ${event.registrationOpen ? 'Open' : 'Closed'}`,
        `Total Registrations: ${eventRegistrations.length}`,
        `Venue: ${event.venue || 'N/A'}`,
        `Date: ${event.date ? new Date(event.date).toLocaleDateString() : 'N/A'}`
      ].join(' | ');

      eventWorksheet.getCell('A1').note = eventDetails;

      // Add registration data (even if empty, it will show headers)
      if (eventRegistrations.length > 0) {
        addRegistrationData(eventWorksheet, eventRegistrations);
        console.log(`Added ${eventRegistrations.length} registrations for event: ${event.name}`);
      } else {
        // For events with no registrations, add a note in the first data row
        eventWorksheet.addRow({
          slNo: 1,
          eventName: event.name,
          category: event.category || 'N/A',
          day: event.day || 'N/A',
          teamName: 'No registrations yet',
          teamSize: '',
          leaderName: '',
          leaderUsn: '',
          teamMembers: '',
          leaderEmail: '',
          leaderMobile: '',
          collegeName: '',
          collegeCode: '',
          registeredAt: '',
          paymentStatus: '',
          paymentRequired: '',
          paymentId: '',
          transactionId: '',
          notes: 'This event has no registrations yet'
        });
        console.log(`No registrations found for event: ${event.name}`);
      }
    });

    // Add team members worksheet if there are any
    const hasTeamMembers = registrations.some(reg => reg.teamMembers && reg.teamMembers.length > 0);

    if (hasTeamMembers) {
      const teamMembersSheet = workbook.addWorksheet('Team Members');

      // Define columns for team members
      teamMembersSheet.columns = [
        { header: 'Sl. No.', key: 'slNo', width: 8 },
        { header: 'Event Name', key: 'eventName', width: 25 },
        { header: 'Team Name', key: 'teamName', width: 20 },
        { header: 'Member Name', key: 'memberName', width: 20 },
        { header: 'Email', key: 'memberEmail', width: 25 },
        { header: 'Mobile', key: 'memberMobile', width: 15 },
        { header: 'College', key: 'memberCollege', width: 30 },
        { header: 'USN', key: 'memberUsn', width: 15 }
      ];

      // Style the header row
      teamMembersSheet.getRow(1).font = { bold: true, size: 12 };
      teamMembersSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }
      };
      teamMembersSheet.getRow(1).font = {
        color: { argb: 'FFFFFFFF' },
        bold: true
      };

      // Add team members data
      let rowIndex = 1;
      registrations.forEach(registration => {
        if (registration.teamMembers && registration.teamMembers.length > 0) {
          registration.teamMembers.forEach(member => {
            rowIndex++;
            teamMembersSheet.addRow({
              slNo: rowIndex - 1,
              eventName: registration.event ? registration.event.name : 'Unknown',
              teamName: registration.teamName || 'N/A',
              memberName: member.name || 'N/A',
              memberEmail: member.email || 'N/A',
              memberMobile: member.mobile || 'N/A',
              memberCollege: member.collegeName || registration.teamLeaderDetails.collegeName || 'N/A',
              memberUsn: member.usn || 'N/A'
            });
          });
        }
      });
    }

    // Set response headers for Excel download
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `Halcyon_All_Events_Registrations_${timestamp}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting registrations to Excel:', err);
    res.status(500).json({ error: err.message });
  }
};

// Export single event to Excel
const exportSingleEventToExcel = async (req, res) => {
  try {
    console.log('🔍 Single event export request received');
    const { eventId } = req.params;
    console.log('📋 Event ID:', eventId);

    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      console.log('❌ Invalid event ID format:', eventId);
      return res.status(400).json({ error: "Invalid event ID format" });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      console.log('❌ Event not found:', eventId);
      return res.status(404).json({ error: "Event not found" });
    }

    console.log('✅ Event found:', event.name);

    // Create a new Excel workbook
    const workbook = new Excel.Workbook();
    workbook.creator = 'Halcyon 2025';
    workbook.lastModifiedBy = 'Admin Dashboard';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Fetch registrations for this specific event
    const registrations = await Registration.find({ event: eventId })
      .populate('event', 'name date venue category day fees')
      .populate('teamLeader', 'name email mobile')
      .populate('spotRegistration', 'name email mobile')
      .populate('teamMembers', 'name mobile email')
      .sort({ registeredAt: -1 });

    console.log(`Found ${registrations.length} registrations for event: ${event.name}`);

    // Helper function to setup worksheet columns and styling
    const setupWorksheet = (worksheet) => {
      // Define columns
      worksheet.columns = [
        { header: 'Sl. No.', key: 'slNo', width: 8 },
        { header: 'Event Name', key: 'eventName', width: 25 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Day', key: 'day', width: 8 },
        { header: 'Team Name', key: 'teamName', width: 20 },
        { header: 'Team Size', key: 'teamSize', width: 10 },
        { header: 'Team Leader Name', key: 'leaderName', width: 20 },
        { header: 'Leader USN', key: 'leaderUsn', width: 15 },
        { header: 'Team Members (Name - USN)', key: 'teamMembers', width: 40 },
        { header: 'Email', key: 'leaderEmail', width: 25 },
        { header: 'Mobile', key: 'leaderMobile', width: 15 },
        { header: 'College', key: 'collegeName', width: 30 },
        { header: 'College Code', key: 'collegeCode', width: 15 },
        { header: 'Registration Date', key: 'registeredAt', width: 20 },
        { header: 'Payment Status', key: 'paymentStatus', width: 18 },
        { header: 'Payment Required', key: 'paymentRequired', width: 18 },
        { header: 'Payment ID', key: 'paymentId', width: 25 },
        { header: 'Transaction ID', key: 'transactionId', width: 25 },
        { header: 'Notes', key: 'notes', width: 30 }
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true, size: 12 };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }
      };
      worksheet.getRow(1).font = {
        color: { argb: 'FFFFFFFF' },
        bold: true
      };
    };

    // Helper function to add registration data to a worksheet
    const addRegistrationData = (worksheet, registrationsList) => {
      registrationsList.forEach((registration, index) => {
        // Get category name
        let categoryName = 'Unknown';
        if (registration.event && registration.event.category) {
          const category = EVENT_CATEGORIES.find(cat => cat.id === registration.event.category);
          categoryName = category ? category.label : 'Unknown';
        }

        // Check if this is a spot registration
        const isSpotRegistration = registration.spotRegistration !== null;

        // For spot registrations, use the participant information from teamLeaderDetails
        const participantName = isSpotRegistration && registration.teamLeaderDetails?.name
          ? registration.teamLeaderDetails.name
          : (registration.teamLeader ? registration.teamLeader.name : 'Unknown');

        const participantEmail = isSpotRegistration && registration.teamLeaderDetails?.email
          ? registration.teamLeaderDetails.email
          : (registration.teamLeader ? registration.teamLeader.email : 'N/A');

        const participantMobile = isSpotRegistration && registration.teamLeaderDetails?.mobile
          ? registration.teamLeaderDetails.mobile
          : (registration.teamLeader ? registration.teamLeader.mobile : 'N/A');

        // Extract team member info from payment ID for spot registrations
        let teamMemberName = '';
        if (isSpotRegistration && registration.spotRegistration) {
          teamMemberName = registration.spotRegistration.name || '';
        } else if (isSpotRegistration && registration.paymentId && registration.paymentId.includes('SPOT_PAYMENT_')) {
          const paymentParts = registration.paymentId.split('_');
          if (paymentParts.length >= 3) {
            teamMemberName = paymentParts.slice(2, -1).join('_');
          }
        }

        // Add a note for spot registrations
        const registrationNote = isSpotRegistration
          ? `Spot registration by ${teamMemberName || registration.spotRegistration?.name || 'team member'}`
          : '';

        // Determine payment requirement text for Excel
        const getPaymentRequiredText = (paymentStatus) => {
          switch (paymentStatus) {
            case 'not_required':
              return 'No';
            case 'pay_on_event_day':
              return 'Yes - On Event Day';
            case 'payment_required':
              return 'Yes - Advance Payment';
            case 'completed':
              return 'No - Already Paid';
            case 'pending':
              return 'Yes - Payment Pending';
            case 'failed':
              return 'Yes - Payment Failed';
            default:
              return 'Unknown';
          }
        };

        // Format team members for display
        let teamMembersText = '';
        if (registration.teamMembers && registration.teamMembers.length > 0) {
          teamMembersText = registration.teamMembers.map(member => {
            const memberName = member.name || 'N/A';
            const memberUsn = member.usn || 'N/A';
            return `${memberName} - ${memberUsn}`;
          }).join('; ');
        } else {
          teamMembersText = 'No additional members';
        }

        worksheet.addRow({
          slNo: index + 1,
          eventName: registration.event ? registration.event.name : 'Unknown',
          category: categoryName,
          day: registration.event ? registration.event.day || 1 : 'N/A',
          teamName: registration.teamName || 'N/A',
          teamSize: registration.teamSize || 1,
          leaderName: participantName,
          leaderUsn: registration.teamLeaderDetails ? registration.teamLeaderDetails.usn : 'N/A',
          teamMembers: teamMembersText,
          leaderEmail: participantEmail,
          leaderMobile: participantMobile,
          collegeName: registration.teamLeaderDetails ? registration.teamLeaderDetails.collegeName : 'N/A',
          collegeCode: registration.collegeCode || 'N/A',
          registeredAt: registration.registeredAt ? new Date(registration.registeredAt).toLocaleString() : 'N/A',
          paymentStatus: registration.paymentStatus || 'N/A',
          paymentRequired: getPaymentRequiredText(registration.paymentStatus),
          paymentId: registration.paymentId || 'N/A',
          transactionId: registration.transactionId || 'N/A',
          notes: registrationNote
        });
      });
    };

    // Create worksheet for the specific event
    const eventWorksheet = workbook.addWorksheet(event.name.substring(0, 31));
    setupWorksheet(eventWorksheet);

    // Add comprehensive event information as a note in cell A1
    const eventDetails = [
      `Event: ${event.name || 'N/A'}`,
      `Category: ${event.category || 'N/A'}`,
      `Day: ${event.day || 'N/A'}`,
      `Fees: ₹${event.fees || 0}`,
      `Team Size: ${event.teamSize || 1}`,
      `Registration Status: ${event.registrationOpen ? 'Open' : 'Closed'}`,
      `Total Registrations: ${registrations.length}`,
      `Venue: ${event.venue || 'N/A'}`,
      `Date: ${event.date ? new Date(event.date).toLocaleDateString() : 'N/A'}`
    ].join(' | ');

    eventWorksheet.getCell('A1').note = eventDetails;

    // Add registration data
    if (registrations.length > 0) {
      addRegistrationData(eventWorksheet, registrations);
    } else {
      // For events with no registrations, add a note in the first data row
      eventWorksheet.addRow({
        slNo: 1,
        eventName: event.name,
        category: event.category || 'N/A',
        day: event.day || 'N/A',
        teamName: 'No registrations yet',
        teamSize: '',
        leaderName: '',
        leaderUsn: '',
        teamMembers: '',
        leaderEmail: '',
        leaderMobile: '',
        collegeName: '',
        collegeCode: '',
        registeredAt: '',
        paymentStatus: '',
        paymentRequired: '',
        paymentId: '',
        transactionId: '',
        notes: 'This event has no registrations yet'
      });
    }

    // Set response headers for Excel download
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedEventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedEventName}_Registrations_${timestamp}.xlsx`;

    console.log('📁 Setting filename:', filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    console.log('📤 Writing Excel file to response...');
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
    console.log('✅ Excel export completed successfully');
  } catch (err) {
    console.error('❌ Error exporting single event to Excel:', err);
    console.error('❌ Error stack:', err.stack);
    res.status(500).json({ error: err.message });
  }
};

// Toggle event registration status
const toggleEventRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event ID format" });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Toggle the registration status
    event.registrationOpen = !event.registrationOpen;

    // Save the updated event
    await event.save();

    res.json({
      message: `Registration for event "${event.name}" is now ${event.registrationOpen ? 'open' : 'closed'}`,
      registrationOpen: event.registrationOpen
    });
  } catch (err) {
    console.error('Error toggling event registration:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await Registration.findById(id);
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    await Registration.findByIdAndDelete(id);
    res.json({ message: `Registration with ID ${id} deleted successfully` });

  } catch (err) {
    console.error('Error deleting registration:', err);
    res.status(500).json({ error: err.message });
  }
}

const sendBulkRegistrationEmails = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Fetch the event details
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Fetch all registrations for this event
    const registrations = await Registration.find({ event: eventId });
    let sentCount = 0;

    // Loop through each registration
    for (const reg of registrations) {
      const leader = reg.teamLeaderDetails;
      const leaderEmail = leader?.email;
      const leaderName = leader?.name || "Team Leader";
      const teamName = reg.teamName || "N/A";
      const teamSize = reg.teamSize || "N/A";

      if (leaderEmail) {
        // Send HTML email
        await sendRegistrationEmail(
          leaderEmail,
          `Registration Confirmation for ${event.name}`,
          `
          <html>
            <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
              <table width="100%" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 5px rgba(0,0,0,0.1); padding: 20px;">
                <tr>
                  <td>
                    <h2 style="color: #2c3e50;">Hello ${leaderName},</h2>
                    <p>Thank you for registering for <strong>${event.name}</strong>!</p>
                    <p><strong>Team Name:</strong> ${teamName}<br/>
                       <strong>Team Size:</strong> ${teamSize}</p>
                    <p>We're thrilled to have your team onboard. Make sure to stay tuned for further updates and instructions related to the event.</p>
                    <p>If you have any questions or need assistance, feel free to reply to this email.</p>
                    <p style="margin-top: 30px;">Warm regards,<br/>
                    <strong>The ${event.name} Team</strong></p>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #777; padding-top: 30px; border-top: 1px solid #eee;">
                    <p>If you received this email in error, please ignore it or contact us at <a href="mailto:support@event.com" style="color: #555;">support@event.com</a>.</p>
                    <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${event.name}. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
          `
        );
        sentCount++;
      }
    }

    return res.json({ message: `Emails sent to ${sentCount} team leaders.` });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send emails" });
  }
};


module.exports = {
  getAllUsers,
  getAllRegistrations,
  assignTeamMember,
  generatePdf,
  generateJudgePdf,
  deleteEvent,
  editEvent,
  exportRegistrationsToExcel,
  exportSingleEventToExcel,
  toggleEventRegistration,
  deleteRegistration,
  sendBulkRegistrationEmails
};

