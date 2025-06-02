const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service:'gmail',
    auth:{
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendRegistrationEmail = async(to,subject,html) => {
    await transporter.sendMail({
        from: `"HalcyonAdmin" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};

module.exports = {sendRegistrationEmail};