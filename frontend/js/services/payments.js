// js/services/payments.js
// Owns: Razorpay order creation, checkout, plan selection UI.
import { state } from '../state.js';
import { API_URL } from '../config.js';
import { openLoginModal, closeModal } from '../utils/ui.js';

export async function payWithRazorpay(planType, amountInINR) {
    if (!state.currentUser) {
        alert('Please sign in before upgrading.');
        closeModal();
        openLoginModal();
        return;
    }

    const btn = document.getElementById('upi-btn-link');

    try {
        if (btn) btn.innerText = 'Creating order...';

        // Step 1: Create a verified order on the backend
        const orderRes = await fetch(`${API_URL}/initiate-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: state.currentUser.uid,
                plan:   planType,
                amount: amountInINR
            })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.success) {
            alert('Could not initiate payment: ' + (orderData.error || 'Server error.'));
            if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`;
            return;
        }

        const order = orderData.data.order;

        // Step 2: Open Razorpay with the order_id — triggers webhook on success
        const options = {
            key:         'rzp_live_SYzqjL2QNwMNDE',
            amount:      order.amount,
            currency:    order.currency,
            order_id:    order.id,
            name:        'Vaad',
            description: `Upgrade to Vaad ${planType.toUpperCase()}`,
            image:       'https://vaad.pages.dev/icon-192.png',
            handler: function(response) {
                if (btn) btn.innerText = 'Payment Successful! Upgrading...';
                setTimeout(() => window.location.reload(), 3000);
            },
            prefill: {
                name:  state.currentUser.displayName || '',
                email: state.currentUser.email || ''
            },
            notes: {
                userId:   state.currentUser.uid,
                planName: planType
            },
            theme: { color: '#8b5cf6' },
            modal: {
                ondismiss: function() {
                    if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`;
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function(response) {
            alert(`Payment Failed: ${response.error.description}`);
            if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`;
        });
        rzp.open();

    } catch (err) {
        console.error('[Payments] Error:', err);
        alert('Network error. Please try again.');
        if (btn) btn.innerText = `Pay ₹${amountInINR} Securely`;
    }
}

export function selectPlan(planType) {
    document.querySelectorAll('.pricing-card').forEach(c => c.style.border = '1px solid var(--border)');
    let amount = 99;
    if (planType === 'pro')     { const c = document.getElementById('pro-card');    if (c) c.style.border = '2px solid var(--primary)'; amount = 99;  }
    if (planType === 'promax')  { const c = document.getElementById('promax-card'); if (c) c.style.border = '2px solid #d4af37';        amount = 199; }
    if (planType === 'supreme') { const c = document.getElementById('supreme-card');if (c) c.style.border = '2px solid #8b5cf6';        amount = 399; }

    const upgradeBtn = document.getElementById('upi-btn-link');
    if (upgradeBtn) {
        upgradeBtn.removeAttribute('href');
        upgradeBtn.innerText = `Pay ₹${amount} Securely`;
        upgradeBtn.onclick = (e) => {
            e.preventDefault();
            upgradeBtn.innerText = 'Opening Checkout...';
            payWithRazorpay(planType, amount);
        };
    }
}
