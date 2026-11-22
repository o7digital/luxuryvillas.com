export const homeSeo = {
  en: {
    title: 'Luxury Villa Rentals in Zihuatanejo | La Casa Que Canta',
    description: 'Discover El Ensueño and El Murmullo, private luxury villas in Zihuatanejo by Playa La Ropa. Four suites and up to 8 guests per villa, by La Casa Que Canta.',
  },
  es: {
    title: 'Luxury Villas en renta en Zihuatanejo | La Casa Que Canta',
    description: 'Renta de villas de lujo en Playa La Ropa, Zihuatanejo. Descubre El Ensueño frente al mar y El Murmullo con vistas a la bahía, de La Casa Que Canta.',
  },
};

// Describe only the accommodation and services already published on the page.
export const villas = [
  {
    slug: 'el-ensueno',
    name: 'El Ensueño',
    url: 'https://www.el-ensueno.com/',
    image: '/assets/responsive/el-ensueno-main-1366.webp',
    en: {
      description: 'El Ensueño is a beachfront luxury villa on Playa La Ropa in Zihuatanejo, with four private suites for up to 8 guests, a private chef, butler and infinity pool.',
      amenities: ['Private chef', 'Butler service', 'Infinity pool', 'Terraces', 'Beachside lounge'],
    },
    es: {
      description: 'El Ensueño es una villa de lujo frente al mar en Playa La Ropa, Zihuatanejo, con cuatro suites privadas para hasta 8 huéspedes, chef privado, mayordomo y piscina infinita.',
      amenities: ['Chef privado', 'Mayordomo', 'Piscina infinita', 'Terrazas', 'Lounge junto a la playa'],
    },
  },
  {
    slug: 'el-murmullo',
    name: 'El Murmullo',
    url: 'https://www.el-murmullo.com/',
    image: '/assets/responsive/el-murmullo-main-1366.webp',
    en: {
      description: 'El Murmullo is a luxury villa above Playa La Ropa in Zihuatanejo, with panoramic bay views, four private suites for up to 8 guests, a private pool and personalized concierge service.',
      amenities: ['Private pool', 'Terraces', 'Personalized concierge', 'Bay views'],
    },
    es: {
      description: 'El Murmullo es una villa de lujo sobre Playa La Ropa, Zihuatanejo, con vistas panorámicas de la bahía, cuatro suites privadas para hasta 8 huéspedes, piscina privada y concierge personalizado.',
      amenities: ['Piscina privada', 'Terrazas', 'Concierge personalizado', 'Vistas a la bahía'],
    },
  },
];
