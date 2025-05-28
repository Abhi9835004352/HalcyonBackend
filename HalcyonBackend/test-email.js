const sendEmail= require('./utils/mailer');
async function testEmail(){
    try{
        await sendEmail('1si23ci002@sit.ac.in','Test Event');
        console.log('Email sent successfully');
    }catch(err){
        console.error('Failed to send email:', err);
    }
}

testEmail();

setTimeout(()=>{
    console.log('Test complete');
    process.exit(0);
},5000);

