export const CONTACT = {
  email: "zacian061@gmail.com",
  phoneDisplay: "+91 63010 59498",
  phoneHref: "tel:+916301059498",
  whatsapp: "916301059498",
  hours: "12:00 pm – 12:00 am, every day",
};

export const whatsappLink = (text: string) =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
