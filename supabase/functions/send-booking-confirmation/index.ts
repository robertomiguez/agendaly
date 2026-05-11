/**
 * This Edge Function is stored locally for version control only.
 * It is not intended to be executed in the local environment.
 */


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-key",
};
const FROM_EMAIL = "Agendaly Booking System <noreply@mail.agendaly.co>";
const REPLY_TO = "agendaly.co+agendaly@gmail.com";
const EMAIL_DELAY_MS = 1000; // 1 email per second (Rate Limit)
const PRIMARY_COLOR = "#a54545"; // From app style
const SUCCESS_COLOR = "#059669"; // Green for money/profit

/* =======================
   Helpers
======================= */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatCurrency = (amount: number | undefined | null, locale: string = 'en') => {
  if (amount === undefined || amount === null) {
    const labels: Record<string, string> = { en: "Free", pt: "Grátis", fr: "Gratuit" };
    return labels[locale] || labels.en;
  }
  const currencyMap: Record<string, string> = { pt: 'BRL', en: 'USD', fr: 'EUR' };
  const currency = currencyMap[locale] || 'USD';
  const formatLocale = locale === 'pt' ? 'pt-BR' : locale === 'fr' ? 'fr-FR' : 'en-US';
  
  return new Intl.NumberFormat(formatLocale, { style: 'currency', currency }).format(amount);
};

function emailLayout(content: string, title: string = "Agendaly Booking System") {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; color: #1a1a1a;">
      <div style="text-align: center; padding: 20px 0;">
        <h2 style="color: ${PRIMARY_COLOR}; margin: 0;">${title}</h2>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        ${content}
      </div>
      <div style="text-align: center; padding-top: 20px; font-size: 12px; color: #6b7280;">
        <strong>Agendaly</strong> is proudly built by <strong>KenosLabs</strong>.
      </div>
    </div>
  `;
}

const translations = {
  en: {
    systemName: "Agendaly Booking System",
    customer: {
      subject: "Booking Confirmed: {providerName}",
      title: "Booking Confirmed!",
      greeting: "Hi {name}, your appointment has been successfully confirmed.",
      service: "Service",
      dateTime: "Date & Time",
      staff: "Staff",
      price: "Price",
      location: "Location",
      notes: "Your Notes",
      footer: "See you soon!"
    },
    provider: {
      subject: "New Booking: {customerName}",
      title: "Ca-ching!",
      subtitle: "Another booking, another profit!",
      service: "Service",
      customer: "Customer",
      staff: "Staff",
      dateTime: "Date & Time",
      location: "Location",
      price: "Price",
      notes: "Customer Notes",
      contact: "Customer Contact:",
      footer: "Keep up the great work! 🚀"
    },
    staff: {
      subject: "New Appointment: {customerName}",
      title: "You're making bank, {firstName}!",
      subtitle: "New appointment confirmed.",
      service: "Service",
      customer: "Customer",
      date: "Date",
      location: "Location",
      value: "Value",
      notes: "Customer Notes",
      footer: "Your hard work is paying off! 🌟"
    }
  },
  pt: {
    systemName: "Sistema de Agendamento Agendaly",
    customer: {
      subject: "Agendamento Confirmado: {providerName}",
      title: "Agendamento Confirmado!",
      greeting: "Olá {name}, seu agendamento foi confirmado com sucesso.",
      service: "Serviço",
      dateTime: "Data e Hora",
      staff: "Profissional",
      price: "Preço",
      location: "Localização",
      notes: "Suas Observações",
      footer: "Até logo!"
    },
    provider: {
      subject: "Novo Agendamento: {customerName}",
      title: "Ca-ching!",
      subtitle: "Mais um agendamento, mais lucro!",
      service: "Serviço",
      customer: "Cliente",
      staff: "Profissional",
      dateTime: "Data e Hora",
      location: "Localização",
      price: "Preço",
      notes: "Observações do Cliente",
      contact: "Contato do Cliente:",
      footer: "Continue com o ótimo trabalho! 🚀"
    },
    staff: {
      subject: "Novo Agendamento: {customerName}",
      title: "Você está faturando, {firstName}!",
      subtitle: "Novo agendamento confirmado.",
      service: "Serviço",
      customer: "Cliente",
      date: "Data",
      location: "Localização",
      value: "Valor",
      notes: "Observações do Cliente",
      footer: "Seu trabalho duro está valendo a pena! 🌟"
    }
  },
  fr: {
    systemName: "Système de Réservation Agendaly",
    customer: {
      subject: "Réservation Confirmée : {providerName}",
      title: "Réservation Confirmée !",
      greeting: "Bonjour {name}, votre rendez-vous a été confirmé avec succès.",
      service: "Service",
      dateTime: "Date et Heure",
      staff: "Personnel",
      price: "Prix",
      location: "Emplacement",
      notes: "Vos Notes",
      footer: "À bientôt !"
    },
    provider: {
      subject: "Nouvelle Réservation : {customerName}",
      title: "Ca-ching !",
      subtitle: "Une autre réservation, un autre profit !",
      service: "Service",
      customer: "Client",
      staff: "Personnel",
      dateTime: "Date et Heure",
      location: "Emplacement",
      price: "Prix",
      notes: "Notes du Client",
      contact: "Contact Client :",
      footer: "Continuez votre excellent travail ! 🚀"
    },
    staff: {
      subject: "Nouveau Rendez-vous : {customerName}",
      title: "Vous gagnez de l'argent, {firstName} !",
      subtitle: "Nouveau rendez-vous confirmé.",
      service: "Service",
      customer: "Client",
      date: "Date",
      location: "Emplacement",
      value: "Valeur",
      notes: "Notes du Client",
      footer: "Votre travail acharné porte ses fruits ! 🌟"
    }
  }
};

/* =======================
   Edge Function
======================= */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    // Explicitly check for API key
    if (!RESEND_API_KEY) {
      console.error("Critical Error: RESEND_API_KEY is missing from environment variables.");
      return new Response(
        JSON.stringify({
          error: "Server configuration error: RESEND_API_KEY is missing. Please set it in Supabase Secrets."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { booking, customer, provider, staff, locale = 'en', selectedAddress } = body;
    const t = translations[locale] || translations.en;

    // Validate payload
    if (!customer?.email || !provider?.email) {
      console.error("Missing email addresses:", { customer: customer?.email, provider: provider?.email });
      return new Response(
        JSON.stringify({ error: "Missing email addresses in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Data prep
    const date = booking.appointment_date;
    const time = booking.start_time;
    const serviceName = booking.service?.name || 'Service';
    const price = booking.service?.price;
    const staffName = staff.name;
    const staffFirstName = staffName.split(' ')[0]; // Extract first name for personalization
    const providerName = provider.business_name;
    const notes = booking.notes;
    
    // Get formatted address - ONLY use selectedAddress from payload, never guess
    const addressObj = selectedAddress;
    
    // Build complete address for display
    const address = addressObj
      ? [addressObj.street_address, addressObj.city, addressObj.state, addressObj.postal_code].filter(Boolean).join(', ')
      : (locale === 'pt' ? "Verifique o endereço no app" : locale === 'fr' ? "Vérifiez l'adresse dans l'app" : "Please verify location in the app");
    
    // Build full address for map URL (include country for better accuracy)
    const fullAddressForMap = addressObj
      ? [addressObj.street_address, addressObj.city, addressObj.state, addressObj.postal_code, addressObj.country_name || addressObj.country_code].filter(Boolean).join(', ')
      : '';
      
    const emailQueue: (() => Promise<any>)[] = [];
    
    // Helper for notes HTML
    const getNotesHtml = (label: string) => notes ? `
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #e5e7eb;">
        <span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${label}</span>
        <span style="font-size: 14px; color: #4b5563; font-style: italic;">"${notes}"</span>
      </div>
    ` : '';
    
    // Helper for map URL
    const getMapLink = (addr: string) => 
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;

    // 1. Email to Customer
    emailQueue.push(async () => {
      const ct = t.customer;
      const mapUrl = fullAddressForMap ? getMapLink(fullAddressForMap) : '';
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: [customer.email],
          subject: ct.subject.replace('{providerName}', providerName),
          html: emailLayout(`
            <h1 style="color: #111827; margin-bottom: 16px;">${ct.title}</h1>
            <p style="font-size: 16px; margin-bottom: 24px;">${ct.greeting.replace('{name}', customer.name)}</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
              <div style="margin-bottom: 12px;">
                <span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${ct.service}</span>
                <span style="font-size: 16px; font-weight: 600; color: #111827;">${serviceName}</span>
              </div>
              
              <div style="margin-bottom: 12px;">
                <span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${ct.dateTime}</span>
                <span style="font-size: 16px; font-weight: 600; color: #111827;">${date} ${locale === 'pt' ? 'às' : locale === 'fr' ? 'à' : 'at'} ${time}</span>
              </div>
               <div style="margin-bottom: 12px;">
                <span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${ct.staff}</span>
                <span style="font-size: 16px; font-weight: 600; color: #111827;">${staffName}</span>
              </div>
              <div style="margin-bottom: 12px;">
                <span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${ct.price}</span>
                <span style="font-size: 16px; font-weight: 600; color: ${PRIMARY_COLOR};">${formatCurrency(price, locale)}</span>
              </div>
              
               <div style="margin-bottom: ${notes ? '12px' : '0'};">
                <span style="display: block; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">${ct.location}</span>
                <span style="font-size: 16px; font-weight: 600; color: #111827;">${providerName}</span>
                <span style="display: block; font-size: 14px; color: #4b5563;">${address}</span>
                <a href="${mapUrl}" target="_blank" style="display: ${mapUrl ? 'inline-block' : 'none'}; margin-top: 8px; font-size: 14px; color: ${PRIMARY_COLOR}; text-decoration: none;">📍 ${locale === 'pt' ? 'Ver no Mapa' : locale === 'fr' ? 'Voir sur la carte' : 'View on Map'} →</a>
              </div>
              ${getNotesHtml(ct.notes)}
            </div>
            <div style="margin-top: 24px; text-align: center;">
              <p style="font-size: 14px; color: #6b7280;">${ct.footer}</p>
            </div>
          `, t.systemName)
        }),
      });
      return { recipient: "Customer", response: await res.json(), status: res.status };
    });
    
    // 2. Email to Provider (Always in English as per original template style, but could be localized if needed)
    // Keeping provider/staff emails consistent with original "money" theme
    emailQueue.push(async () => {
      const pt = t.provider;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: [provider.email],
          subject: pt.subject.replace('{customerName}', customer.name),
          html: emailLayout(`
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 48px; margin-bottom: 8px;">💰</div>
              <h1 style="color: #111827; margin: 0;">${pt.title}</h1>
              <p style="color: ${SUCCESS_COLOR}; font-weight: 600; font-size: 18px; margin: 8px 0;">${pt.subtitle}</p>
            </div>
            
             <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
               <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${pt.service}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right;">${serviceName}</td>
                </tr>
                 <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${pt.customer}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right;">${customer.name}</td>
                </tr>
                 <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${pt.staff}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right;">${staffName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${pt.dateTime}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right;">${date} ${time}</td>
                </tr>
                 <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; vertical-align: top;">${pt.location}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    <span style="display: block; font-weight: 600; color: #111827;">${providerName}</span>
                    <span style="display: block; font-size: 14px; color: #6b7280;">${address}</span>
                  </td>
                </tr>
                 <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${pt.price}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right; color: ${SUCCESS_COLOR};">${formatCurrency(price, locale)}</td>
                </tr>
               </table>
               
               ${getNotesHtml(pt.notes)}
               <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #d1d5db;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">${pt.contact}</p>
                  <p style="margin: 4px 0 0 0; font-weight: 500;">${customer.email}</p>
               </div>
            </div>
            <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 14px;">
              ${pt.footer}
            </div>
          `, t.systemName)
        }),
      });
      return { recipient: "Provider", response: await res.json(), status: res.status };
    });
    
    // 3. Email to Staff
    if (staff.email && staff.email.includes('@') && staff.email !== provider.email) {
      emailQueue.push(async () => {
        const st = t.staff;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            reply_to: REPLY_TO,
            to: [staff.email],
            subject: st.subject.replace('{customerName}', customer.name),
            html: emailLayout(`
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 48px; margin-bottom: 8px;">💸</div>
                <h1 style="color: #111827; margin: 0;">${st.title.replace('{firstName}', staffFirstName)}</h1>
                <p style="color: ${SUCCESS_COLOR}; font-weight: 600; font-size: 18px; margin: 8px 0;">${st.subtitle}</p>
              </div>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px;">
                 <p style="margin: 0 0 8px 0;"><strong>${st.service}:</strong> ${serviceName}</p>
                 <p style="margin: 0 0 8px 0;"><strong>${st.customer}:</strong> ${customer.name}</p>
                 <p style="margin: 0 0 8px 0;"><strong>${st.date}:</strong> ${date} ${locale === 'pt' ? 'às' : locale === 'fr' ? 'à' : 'at'} ${time}</p>
                 <div style="margin-bottom: 8px;">
                    <span style="display: block; font-weight: 700;">${st.location}:</span>
                    <span style="display: block; font-weight: 600; color: #111827;">${providerName}</span>
                    <span style="display: block; font-size: 14px; color: #4b5563;">${address}</span>
                 </div>
                 <p style="margin: 0; font-size: 18px;"><strong>${st.value}:</strong> <span style="color: ${SUCCESS_COLOR};">${formatCurrency(price, locale)}</span></p>
                 
                 ${getNotesHtml(st.notes)}
              </div>
              <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 14px;">
                ${st.footer}
              </div>
            `, t.systemName)
          }),
        });
        return { recipient: "Staff", response: await res.json(), status: res.status };
      });
    }
    
    /* =======================
       Send emails respecting 1/sec limit
    ======================= */
    const results = [];
    for (const send of emailQueue) {
      try {
        const result = await send();
        if (result.status >= 400) {
          console.error(`[Resend API Error] Failed to send email to ${result.recipient}. Status ${result.status}:`, JSON.stringify(result.response));
        }
        results.push(result);
      } catch (err: any) {
        console.error("Failed to execute email send:", err);
        results.push({ error: err.message });
      }
      // Delay before next email
      if (emailQueue.indexOf(send) < emailQueue.length - 1) {
        await wait(EMAIL_DELAY_MS);
      }
    }
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Unexpected Error processing request:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
