import { NextRequest, NextResponse } from 'next/server';

// SMS Templates for different languages
const SMS_TEMPLATES = {
  en: {
    confirmation: 'Dear {name}, your table is confirmed for {day} at {service}. See you soon!',
    reminder: 'Reminder: Your table is booked for {day} at {service}. We look forward to seeing you!',
  },
  fr: {
    confirmation: 'Cher(e) {name}, votre table est confirmee pour {day} a {service}. A bientot!',
    reminder: 'Rappel: Votre table est reservee pour {day} a {service}. Nous vous attendons avec impatience!',
  },
  de: {
    confirmation: 'Liebe(r) {name}, Ihr Tisch ist fur {day} um {service} bestatigt. Bis bald!',
    reminder: 'Erinnerung: Ihr Tisch ist fur {day} um {service} reserviert. Wir freuen uns auf Sie!',
  },
};

// Helper function to format message with variables
function formatMessage(template: string, variables: Record<string, string>): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return message;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      phoneNumber, 
      guestName, 
      day, 
      service, 
      language = 'en',
      messageType = 'confirmation'
    } = body;

    // Validate required fields
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    if (!guestName) {
      return NextResponse.json({ error: 'Guest name is required' }, { status: 400 });
    }

    // Get environment variables for Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    // Check if Twilio is configured
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      // Return a mock success if Twilio is not configured (for development)
      console.log('Twilio not configured. Mock SMS would be sent to:', phoneNumber);
      console.log('Message:', formatMessage(
        SMS_TEMPLATES[language as keyof typeof SMS_TEMPLATES]?.[messageType as keyof typeof SMS_TEMPLATES['en']] || SMS_TEMPLATES.en.confirmation,
        { name: guestName, day: day || 'your reserved day', service: service || 'your scheduled time' }
      ));
      
      return NextResponse.json({ 
        success: true, 
        message: 'SMS would be sent (Twilio not configured)',
        mock: true
      });
    }

    // Get the appropriate template
    const templates = SMS_TEMPLATES[language as keyof typeof SMS_TEMPLATES] || SMS_TEMPLATES.en;
    const template = templates[messageType as keyof typeof templates] || templates.confirmation;

    // Format the message
    const message = formatMessage(template, {
      name: guestName,
      day: day || 'your reserved day',
      service: service || 'your scheduled time',
    });

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', twilioPhoneNumber);
    formData.append('Body', message);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', result);
      return NextResponse.json({ 
        error: 'Failed to send SMS', 
        details: result.message || 'Unknown error' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      messageSid: result.sid,
      message: 'SMS sent successfully'
    });

  } catch (error) {
    console.error('SMS sending error:', error);
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
  }
}

// GET endpoint to check SMS configuration status
export async function GET() {
  const isConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_PHONE_NUMBER
  );

  return NextResponse.json({
    configured: isConfigured,
    templates: {
      languages: ['en', 'fr', 'de'],
      types: ['confirmation', 'reminder']
    }
  });
}
