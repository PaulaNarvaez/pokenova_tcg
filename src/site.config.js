export const store = {
  name: 'Pokenova TCG',
  whatsapp: '56998716582',
  currency: 'CLP',
  locale: 'es-CL',
};

export function whatsappUrl(message) {
  return `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(message)}`;
}
