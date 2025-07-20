const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;
const pool = require('./database');

// Check if Stripe is configured
const isStripeConfigured = () => {
  return stripe !== null;
};

// Create Stripe customer
const createCustomer = async (email, userId) => {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }
  
  try {
    const customer = await stripe.customers.create({
      email: email,
      metadata: { userId: userId.toString() }
    });
    return customer;
  } catch (error) {
    throw error;
  }
};

// Create subscription
const createSubscription = async (customerId, priceId = 'price_1234567890') => { // Replace with actual Stripe price ID
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    return subscription;
  } catch (error) {
    throw error;
  }
};

// Update subscription in database
const updateSubscriptionInDB = async (userId, subscriptionData) => {
  try {
    const { id, customer, status, current_period_start, current_period_end } = subscriptionData;
    
    const result = await pool.query(`
      INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end)
      VALUES ($1, $2, $3, $4, to_timestamp($5), to_timestamp($6))
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        stripe_subscription_id = $3,
        status = $4,
        current_period_start = to_timestamp($5),
        current_period_end = to_timestamp($6),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [userId, customer, id, status, current_period_start, current_period_end]);

    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// Get user subscription status
const getUserSubscription = async (userId) => {
  try {
    const result = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
};

// Cancel subscription
const cancelSubscription = async (subscriptionId) => {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }
  try {
    const subscription = await stripe.subscriptions.del(subscriptionId);
    return subscription;
  } catch (error) {
    throw error;
  }
};

// Handle Stripe webhooks
const handleWebhook = async (event) => {
  if (!isStripeConfigured()) {
    console.log('Stripe webhook received, but Stripe is not configured.');
    return;
  }
  try {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        const subscription = event.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const userId = parseInt(customer.metadata.userId);
        
        if (userId) {
          await updateSubscriptionInDB(userId, subscription);
        }
        break;
        
      case 'customer.subscription.deleted':
        const deletedSub = event.data.object;
        await pool.query(
          'UPDATE subscriptions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE stripe_subscription_id = $2',
          ['canceled', deletedSub.id]
        );
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createCustomer,
  createSubscription,
  updateSubscriptionInDB,
  getUserSubscription,
  cancelSubscription,
  handleWebhook,
  isStripeConfigured
}; 