const Registration = require('../models/registrationModel');
const Event = require('../models/eventModel');

// Create order for payment
const createOrder = async (req, res) => {
    try {
        const { eventId } = req.params;

        // Get event details to check fees
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }

        // If event is free, return success without payment
        if (!event.fees || event.fees === 0) {
            return res.status(200).json({
                freeEvent: true,
                message: "This is a free event, no payment required"
            });
        }

        // Generate a unique order ID
        const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp (seconds)
        const shortUserId = req.user._id.toString().slice(-6);
        const orderId = `order_${timestamp}_${shortUserId}`;

        console.log('Creating order for ERP payment:', {
            orderId,
            amount: event.fees,
            eventName: event.name
        });

        // Return the ERP redirect information
        res.status(200).json({
            orderId: orderId,
            amount: event.fees,
            currency: 'INR',
            redirectUrl: 'https://erp.sit.ac.in',
            eventName: event.name,
            requiresPayment: true
        });
    } catch (err) {
        console.error("Payment order creation error:", err);
        res.status(500).json({ error: err.message });
    }
};

// Verify payment (called after user returns from ERP)
const verifyPayment = async (req, res) => {
    try {
        const { orderId, paymentId } = req.body;

        console.log('Verifying ERP payment:', {
            orderId,
            paymentId
        });

        // Find registration with this order ID
        const registration = await Registration.findOne({ orderId: orderId });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "No registration found with this order ID"
            });
        }

        // Update payment status to completed
        await Registration.findByIdAndUpdate(registration._id, {
            paymentStatus: 'completed',
            paymentId: paymentId || `erp_payment_${Date.now()}`
        });

        console.log('Updated registration payment status to completed for order:', orderId);

        res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            paymentId: paymentId || `erp_payment_${Date.now()}`,
            orderId: orderId
        });
    } catch (err) {
        console.error("Payment verification error:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { createOrder, verifyPayment };