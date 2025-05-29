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

const getAllUsers = async (req, res) => {
  try {
    // Optional: Add pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments();

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: err.message });
  }
}
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
      .populate('teamMembers', 'name mobile email');

    if (!registrations || registrations.length === 0) {
      return res.status(404).json({ error: "No registrations found" });
    }

    res.json(registrations);
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
      .populate('event', 'name');

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
    <title>Registrations 2024</title>
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
      }

      th {
        background-color: #f0f0f0;
        font-weight: bold;
        text-align: center;
      }

      td:nth-child(1), td:nth-child(4) {
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
        <th>Team Leader</th>
        <th>Contact No.</th>
        <th>Transaction ID</th>
      </tr>
      ${registrations.length > 0 ?
        registrations.map((registration, index) => {
          return `
            <tr>
              <td>${index + 1}</td>
              <td>${registration.teamName || 'N/A'}</td>
              <td>${registration.teamLeader?.name || 'N/A'}</td>
              <td>${registration.teamLeader?.mobile || 'N/A'}</td>
              <td>${registration.teamLeader?.transactionId || 'N/A'}</td>
            </tr>`;
        }).join('') :
        `<tr><td colspan="5" class="no-data">No registrations found for this event</td></tr>`
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
      .sort({ 'event.name': 1, registeredAt: 1 });

    if (registrations.length === 0) {
      return res.status(404).json({ error: "No registrations found" });
    }

    // Create a worksheet
    const worksheet = workbook.addWorksheet('Registrations');

    // Define columns
    worksheet.columns = [
      { header: 'Sl. No.', key: 'slNo', width: 8 },
      { header: 'Event Name', key: 'eventName', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Day', key: 'day', width: 8 },
      { header: 'Team Name', key: 'teamName', width: 20 },
      { header: 'Team Size', key: 'teamSize', width: 10 },
      { header: 'Participant Name', key: 'leaderName', width: 20 },
      { header: 'Email', key: 'leaderEmail', width: 25 },
      { header: 'Mobile', key: 'leaderMobile', width: 15 },
      { header: 'College', key: 'collegeName', width: 30 },
      { header: 'USN', key: 'usn', width: 15 },
      { header: 'Registration Date', key: 'registeredAt', width: 20 },
      { header: 'Payment Status', key: 'paymentStatus', width: 15 },
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

    // Add data to the worksheet
    registrations.forEach((registration, index) => {
      // Get category name
      let categoryName = 'Unknown';
      if (registration.event && registration.event.category) {
        const category = EVENT_CATEGORIES.find(cat => cat.id === registration.event.category);
        categoryName = category ? category.label : 'Unknown';
      }

      // Check if this is a spot registration
      const isSpotRegistration = registration.spotRegistration !== null;

      // For spot registrations, use the first team member as the participant
      const participantName = isSpotRegistration && registration.teamMembers && registration.teamMembers.length > 0
        ? registration.teamMembers[0].name
        : (registration.teamLeader ? registration.teamLeader.name : 'Unknown');

      const participantEmail = isSpotRegistration && registration.teamMembers && registration.teamMembers.length > 0
        ? registration.teamMembers[0].email
        : (registration.teamLeader ? registration.teamLeader.email : 'N/A');

      const participantMobile = isSpotRegistration && registration.teamMembers && registration.teamMembers.length > 0
        ? registration.teamMembers[0].mobile
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

      worksheet.addRow({
        slNo: index + 1,
        eventName: registration.event ? registration.event.name : 'Unknown',
        category: categoryName,
        day: registration.event ? registration.event.day || 1 : 'N/A',
        teamName: registration.teamName || 'N/A',
        teamSize: registration.teamSize || 1,
        leaderName: participantName,
        leaderEmail: participantEmail,
        leaderMobile: participantMobile,
        collegeName: registration.teamLeaderDetails ? registration.teamLeaderDetails.collegeName : 'N/A',
        usn: registration.teamLeaderDetails ? registration.teamLeaderDetails.usn : 'N/A',
        registeredAt: registration.registeredAt ? new Date(registration.registeredAt).toLocaleString() : 'N/A',
        paymentStatus: registration.paymentStatus || 'N/A',
        paymentId: registration.paymentId || 'N/A',
        transactionId: registration.teamLeader?.transactionId || 'N/A',
        notes: registrationNote
      });
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
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Halcyon_All_Registrations.xlsx');

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting registrations to Excel:', err);
    res.status(500).json({ error: err.message });
  }
};

// Define EVENT_CATEGORIES constant for use in the Excel export
const EVENT_CATEGORIES = [
  { id: 'dance', label: 'Dance', icon: 'fas fa-music' },
  { id: 'music', label: 'Music', icon: 'fas fa-guitar' },
  { id: 'gaming', label: 'Gaming', icon: 'fas fa-gamepad' },
  { id: 'theatre', label: 'Theatre', icon: 'fas fa-theater-masks' },
  { id: 'finearts', label: 'Fine Arts', icon: 'fas fa-paint-brush' },
  { id: 'literary', label: 'Literary', icon: 'fas fa-book' }
];

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
  toggleEventRegistration,
  deleteRegistration
};