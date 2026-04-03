// js/services/payments.js
import { state } from "../state.js";
import { openLoginModal, closeUpgradeModal } from "../utils/ui.js";

export function payWithRazorpay(planType, amountInINR) {
    if (!state.currentUser) {
        alert("Please sign in to create your account before upgrading.");
        closeUpgradeModal(); 
        openLoginModal(); 
        return;
    }

    const options = {
        "key": "rzp_live_SYzqjL2QNwMNDE", // Replace with actual live key in production
        "amount": amountInINR * 100,
        "currency": "INR",
        "name": "Vaad",
        "description": `Upgrade to Vaad ${planType.toUpperCase()}`,
        "image": "https://vaad.pages.dev/icon-192.png",
        "handler": function (response) {
            const btn = document.getElementById('upi-btn-link');
            if (btn) btn.innerText = "Payment Successful! Upgrading...";
            setTimeout(() => window.location.reload(), 3000);
        },
        "prefill": { "name": state.currentUser.displayName || "", "email": state.currentUser.email || "" },
        "notes": { "userId": state.currentUser.uid, "planName": planType },
        "theme": { "color": "#8b5cf6" }
    };
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response){ alert(`Payment Failed: ${response.error.description}`); });
    rzp.open();
}

export function selectPlan(planType) {
    document.querySelectorAll('.pricing-card').forEach(c => c.style.border = '1px solid var(--border)');
    let amount = 99; 
    
    if (planType === 'pro') { 
        const card = document.getElementById('pro-card');
        if(card) card.style.border = '2px solid var(--primary)'; amount = 99; 
    } else if (planType === 'promax') { 
        const card = document.getElementById('promax-card');
        if(card) card.style.border = '2px solid #d4af37'; amount = 199; 
    } else if (planType === 'supreme') { 
        const card = document.getElementById('supreme-card');
        if(card) card.style.border = '2px solid #8b5cf6'; amount = 399; 
    }

    const upgradeBtn = document.getElementById('upi-btn-link');
    if (upgradeBtn) {
        upgradeBtn.removeAttribute('href'); 
        upgradeBtn.innerText = `Pay ₹${amount} Securely`;
        upgradeBtn.onclick = (e) => { 
            e.preventDefault(); 
            upgradeBtn.innerText = "Opening Checkout..."; 
            payWithRazorpay(planType, amount); 
        };
    }
}
