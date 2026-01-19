type OrderEmailInput = {
  orderNumber: string;
  createdAt: string;
  customer: {
    firstName: string;
    lastName: string;
    country: string;
    email: string;
    phone: string;
    address: string;
    addressLine2: string;
    city: string;
    province: string;
    zipCode: string;
    orderNotes: string;
  };
  shipToDifferentAddress: boolean;
  shippingAddress?: {
    address: string;
    addressLine2: string;
    city: string;
    province: string;
    zipCode: string;
  };
  shippingMethod: "regular" | "express";
  subtotal: number;
  shippingCost: number;
  total: number;
  cartItems: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
  }>;
};

const paymentDetails = {
  recipientName: "Pure Tide Payments",
  recipientEmail: "contraviento@gmail.com",
  securityQuestion: "Order number?",
  securityAnswerPrefix: "PT",
  supportEmail: "contraviento@gmail.com",
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export function buildOrderEmail(input: OrderEmailInput) {
  const orderDate = formatDate(input.createdAt);
  const orderName = `${input.customer.firstName} ${input.customer.lastName}`.trim();
  const securityAnswer = `${paymentDetails.securityAnswerPrefix}${input.orderNumber}`;
  const shippingLabel = input.shippingMethod === "express" ? "Express Shipping" : "Regular Shipping";
  const billingLines = [
    orderName,
    input.customer.address,
    input.customer.addressLine2,
    `${input.customer.city} ${input.customer.province} ${input.customer.zipCode}`.trim(),
    input.customer.country,
    input.customer.email,
  ].filter(Boolean);
  const shippingSource = input.shipToDifferentAddress && input.shippingAddress ? input.shippingAddress : input.customer;
  const shippingLines = [
    orderName,
    shippingSource.address,
    shippingSource.addressLine2,
    `${shippingSource.city} ${shippingSource.province} ${shippingSource.zipCode}`.trim(),
    input.customer.country,
  ].filter(Boolean);

  const itemsText = input.cartItems
    .map((item) => `- ${item.name} x${item.quantity} (${formatMoney(item.price * item.quantity)})`)
    .join("\n");

  const text = [
    "Pure Tide",
    "",
    "Thank you for your order",
    `Hi ${input.customer.firstName},`,
    "",
    "We have received your order and it is on hold until payment is confirmed.",
    "",
    "Interac e-Transfer Instructions",
    "",
    "After placing your order, please send an Interac e-Transfer following the instructions below. Enter everything exactly as shown so your payment is automatically accepted.",
    "",
    `Recipient Name: ${paymentDetails.recipientName}`,
    `Recipient Email: ${paymentDetails.recipientEmail}`,
    `Security Question: ${paymentDetails.securityQuestion}`,
    `Security Answer: ${securityAnswer}`,
    `Memo/Message: ${input.orderNumber}`,
    "",
    "Important: Use the exact Security Question and Answer above. Any changes can delay your payment acceptance or have your payment refused.",
    "",
    "If your bank does not allow a memo, you can leave it empty.",
    "",
    "We only accept e-Transfers sent to the email listed above. Do not send payments to any other email address.",
    "",
    "If your payment is not accepted, please go to your banking app, cancel and re-send with correct instructions above.",
    "",
    `Should you encounter any payment related issues, please contact our support at: ${paymentDetails.supportEmail}`,
    "",
    "Order summary",
    `Order #${input.orderNumber} (${orderDate})`,
    "",
    "Products",
    itemsText,
    "",
    `Subtotal: ${formatMoney(input.subtotal)}`,
    `Shipping: ${shippingLabel} ${formatMoney(input.shippingCost)}`,
    `Total: ${formatMoney(input.total)}`,
    "Payment method: Interac e-Transfer",
    "",
    "Billing address",
    ...billingLines,
    "",
    "Shipping address",
    ...shippingLines,
    "",
    `Thanks again! If you need any help with your order, please contact us at ${paymentDetails.supportEmail}.`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0b3f3c; line-height: 1.5;">
      <h2 style="margin: 0 0 8px;">Pure Tide</h2>
      <h3 style="margin: 0 0 16px;">Thank you for your order</h3>
      <p>Hi ${input.customer.firstName},</p>
      <p>We have received your order and it is on hold until payment is confirmed.</p>

      <h4 style="margin: 24px 0 8px;">Interac e-Transfer Instructions</h4>
      <p>After placing your order, please send an Interac e-Transfer following the instructions below. Enter everything exactly as shown so your payment is automatically accepted.</p>
      <ul>
        <li><strong>Recipient Name:</strong> ${paymentDetails.recipientName}</li>
        <li><strong>Recipient Email:</strong> ${paymentDetails.recipientEmail}</li>
        <li><strong>Security Question:</strong> ${paymentDetails.securityQuestion}</li>
        <li><strong>Security Answer:</strong> ${securityAnswer}</li>
        <li><strong>Memo/Message:</strong> ${input.orderNumber}</li>
      </ul>
      <p><strong>Important:</strong> Use the exact Security Question and Answer above. Any changes can delay your payment acceptance or have your payment refused.</p>
      <p>If your bank does not allow a memo, you can leave it empty.</p>
      <p>We only accept e-Transfers sent to the email listed above. Do not send payments to any other email address.</p>
      <p>If your payment is not accepted, please go to your banking app, cancel and re-send with correct instructions above.</p>
      <p>Should you encounter any payment related issues, please contact our support at: <strong>${paymentDetails.supportEmail}</strong></p>

      <h4 style="margin: 24px 0 8px;">Order summary</h4>
      <p><strong>Order #${input.orderNumber}</strong> (${orderDate})</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Product</th>
            <th style="text-align: left; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Quantity</th>
            <th style="text-align: right; padding: 6px 0; border-bottom: 1px solid #cdd9d7;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${input.cartItems
            .map(
              (item) => `
              <tr>
                <td style="padding: 6px 0;">${item.name}</td>
                <td style="padding: 6px 0;">x${item.quantity}</td>
                <td style="padding: 6px 0; text-align: right;">${formatMoney(item.price * item.quantity)}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
      <p><strong>Subtotal:</strong> ${formatMoney(input.subtotal)}</p>
      <p><strong>Shipping:</strong> ${shippingLabel} ${formatMoney(input.shippingCost)}</p>
      <p><strong>Total:</strong> ${formatMoney(input.total)}</p>
      <p><strong>Payment method:</strong> Interac e-Transfer</p>

      <h4 style="margin: 24px 0 8px;">Billing address</h4>
      <p>${billingLines.join("<br />")}</p>
      <h4 style="margin: 16px 0 8px;">Shipping address</h4>
      <p>${shippingLines.join("<br />")}</p>

      <p style="margin-top: 24px;">Thanks again! If you need any help with your order, please contact us at ${paymentDetails.supportEmail}.</p>
    </div>
  `;

  return {
    subject: `Order #${input.orderNumber} - Interac e-Transfer instructions`,
    text,
    html,
  };
}
