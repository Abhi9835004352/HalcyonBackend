const User = require('../models/userModel');
const Registration = require('../models/registrationModel');
const Event = require('../models/eventModel');
const pdf = require('html-pdf');
const fs = require('fs');
const path = require('path');
const Excel = require('exceljs');
const mongoose = require('mongoose');
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
const generatePdf = async (req, res) => {
  try {
    const { eventID } = req.params;
    const event = await Event.findById(eventID);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Get registrations with participant details
    const registrations = await Registration.find({ event: eventID })
      .populate('teamLeader', 'name email mobile')
      .populate('event', 'name date venue category day fees');

    // Read and encode the image
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      imageBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (imgErr) {
      console.error('Error reading image:', imgErr);
      imageBase64 = ''; // Set empty if image can't be read
    }

    if (!registrations) return res.status(404).json({ error: "No registrations found" });

    const html = `
<html>
  <head>
    <title>Registrations 2025</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
        margin: 40px;
        color: #000;
      }

      .header {
        text-align: center;
        position: relative;
        padding: 20px 0;
        margin-bottom: 20px;
      }

      .header-bg {
        position: relative;
        background-image: url('${imageBase64}');
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
        padding: 30px 0;
        min-height: 100px;
      }

      h1, h2 {
        text-align: center;
        margin: 0;
        padding: 4px;
      }

      h1 {
        font-size: 28px;
        font-weight: bold;
        text-transform: uppercase;
      }

      h2 {
        font-size: 20px;
        font-weight: normal;
        margin-bottom: 10px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 30px;
      }

      th, td {
        border: 1px solid #000;
        padding: 8px 12px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background-color: #f0f0f0;
        font-weight: bold;
        text-align: center;
      }

      td:nth-child(1) {
        text-align: center;
      }

      tr:nth-child(even) {
        background-color: #fafafa;
      }

      .no-data {
        text-align: center;
        padding: 20px;
        font-style: italic;
        color: #666;
      }

      .team-members {
        margin-top: 5px;
        font-size: 12px;
        color: #555;
      }

      .team-member {
        margin: 2px 0;
        padding: 2px 0;
        border-bottom: 1px dotted #ccc;
      }

      .team-member:last-child {
        border-bottom: none;
      }

      .member-name {
        font-weight: bold;
      }

      .member-usn {
        color: #666;
        font-style: italic;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="header-bg">
        <h1>HALCYON 2025</h1>
      </div>
      <h2>Registrations</h2>
      <h2>Event: ${event.name}</h2>
    </div>
    <table>
      <tr>
        <th>Sl. No.</th>
        <th>Team Name</th>
        <th>Team Leader & Members</th>
        <th>Contact No.</th>
        <th>College</th>
        <th>Transaction ID</th>
      </tr>
      ${registrations.length > 0 ?
        registrations.map((registration, index) => {
          // Generate team members list
          let teamMembersHtml = '';
          if (registration.teamMembers && registration.teamMembers.length > 0) {
            teamMembersHtml = `
              <div class="team-members">
                <strong>Team Members:</strong>
                ${registration.teamMembers.map(member => `
                  <div class="team-member">
                    <span class="member-name">${member.name || 'N/A'}</span>
                    ${member.usn ? `<span class="member-usn"> (${member.usn})</span>` : ''}
                  </div>
                `).join('')}
              </div>
            `;
          }

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${registration.teamName || 'N/A'}</td>
              <td>
                <strong>Leader:</strong> ${
                  registration.spotRegistration && registration.teamLeaderDetails?.name
                    ? registration.teamLeaderDetails.name
                    : registration.teamLeader?.name || 'N/A'
                }
                ${registration.teamLeaderDetails?.usn ? `<br><span class="member-usn">(${registration.teamLeaderDetails.usn})</span>` : ''}
                ${teamMembersHtml}
              </td>
              <td>${registration.teamLeader?.mobile || 'N/A'}</td>
              <td>${registration.teamLeaderDetails?.collegeName || 'N/A'}</td>
              <td>${registration.transactionId || 'N/A'}</td>
            </tr>`;
        }).join('') :
        `<tr><td colspan="6" class="no-data">No registrations found for this event</td></tr>`
      }
    </table>
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
      res.setHeader('Content-Disposition', 'attachment; filename=registrations.pdf');
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

module.exports = {
  getAllUsers,
  getAllRegistrations,
  assignTeamMember,
  generatePdf,
  deleteEvent,
  editEvent,
  exportRegistrationsToExcel,
  exportSingleEventToExcel,
  toggleEventRegistration,
  deleteRegistration
};