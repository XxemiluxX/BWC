import { auth, db } from "./firebase-client.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { todayKey, yesterdayKey, pageKeyFromPath, avatarHTML, cosmeticsFromUser } from "./missions-data.js";

export const THEME_KEY = "ecra_theme_v2";
export const ADMIN_EMAIL = "mongemoraemiliano60@gmail.com";
export const CONTACT_PHONE = "87506973";
export const CONTACT_EMAIL = "proyecto.ecracr@gmail.com";

// Catálogo completo de retos ecológicos accesibles, prácticos y seguros
export const CHALLENGES = [
  {
    id: "challenge-1",
    number: 1,
    title: "Separa tu basura: orgánicos, reciclables y el resto",
    shortTitle: "Residuos y reciclaje",
    category: "waste",
    categoryLabel: "Reciclaje y basura",
    difficulty: "Principiante",
    duration: "20-30 min",
    icon: "♻️",
    summary: "Separa la basura de tu casa en tres bolsas y reduce lo que termina en el basurero.",
    instruction: "Revisa los residuos generados hoy en tu hogar o espacio de trabajo. Separa al menos tres categorías: orgánicos (para compost), reciclables limpios y secos (plásticos, papel, cartón o vidrio) y no reciclables. Llévalos o déjalos listos para el centro de acopio o ruta de reciclaje local.",
    concreteActions: [
      "Limpia y seca envases de plástico, latas o vidrio antes de disponerlos.",
      "Separa cartón y papel evitando que se contaminen con grasa o líquidos.",
      "Identifica el centro de reciclaje o día de recolección selectiva de tu municipalidad."
    ],
    whyItMatters: "La separación en el hogar evita que toneladas de materiales útiles terminen contaminando ríos, costas y vertederos."
  },
  {
    id: "challenge-2",
    number: 2,
    title: "Cuida el agua: revisa fugas y protege tu naciente",
    shortTitle: "Conservación de agua",
    category: "water",
    categoryLabel: "Agua y nacientes",
    difficulty: "Intermedio",
    duration: "30-45 min",
    icon: "💧",
    summary: "Busca goteos en tu casa, ahorra agua y cuida la quebrada o naciente que tengas cerca.",
    instruction: "Realiza una inspección en tu casa o comunidad para detectar goteos en grifos, inodoros o mangueras. Implementa medidas inmediatas de ahorro: duchas de máximo 4 minutos, cerrar la llave al enjabonar platos y, si vives cerca de una quebrada o naciente, asegúrate de que no haya basura ni desechos cerca.",
    concreteActions: [
      "Revisa empaques de llaves y tuberías para eliminar goteos continuos.",
      "Aprovecha el agua de lavado de frutas o lluvia para regar plantas de jardín.",
      "Evita verter aceites de cocina o químicos al desagüe; almacena el aceite usado en botellas plásticas."
    ],
    whyItMatters: "Las fuentes de agua dulce son vulnerables. Proteger nacientes garantiza agua limpia y vida para nuestras comunidades y ecosistemas."
  },
  {
    id: "challenge-3",
    number: 3,
    title: "Un rinconcito para abejas y mariposas",
    shortTitle: "Flora y fauna",
    category: "wildlife",
    categoryLabel: "Plantas y animales",
    difficulty: "Principiante",
    duration: "30 min",
    icon: "🦋",
    summary: "Siembra plantas con flores y atrae abejas, mariposas y pajaritos a en tu jardin.",
    instruction: "Crea o cuida un pequeño espacio verde con plantas con flores atractivas para polinizadores (como ruda, ortencias, girasoles o aromáticas). Si tienes jardín, evita podar en exceso la vegetación silvestre y no apliques pesticidas ni venenos que dañen a insectos benéficos.",
    concreteActions: [
      "Coloca un bebedero seguro para polinizadores (plato poco profundo con piedras limpias y agua fresca).",
      "Planta al menos una especie autóctona o aromática en maceta o suelo directo.",
      "Aprende a identificar 2 especies de aves o mariposas habituales en tu zona."
    ],
    whyItMatters: "Los polinizadores sostienen más del 75% de los cultivos que alimentan al mundo y están en declive por la pérdida de hábitat."
  },
  {
    id: "challenge-4",
    number: 4,
    title: "Apagones electricos, desconecta lo que no usas",
    shortTitle: "Ahorro de energía",
    category: "energy",
    categoryLabel: "Luz y energía",
    difficulty: "Principiante",
    duration: "20 min",
    icon: "⚡",
    summary: "Desconecta cargadores y aparatos en espera y baja tu recibo de luz.",
    instruction: "Recorre tu casa y desconecta los cargadores, electrodomésticos y dispositivos que consumen energía 'fantasma' en modo de espera. Aprovecha al máximo la luz natural abriendo cortinas y planifica sustituir focos incandescentes por tecnología LED.",
    concreteActions: [
      "Desconecta cargadores de celular y computadoras cuando no estén en uso.",
      "Usa regletas con interruptor para apagar de un solo paso centros de entretenimiento.",
      "Limpia focos y lámparas para mejorar la luminosidad sin necesidad de más watts."
    ],
    whyItMatters: "La generación eléctrica muchas veces depende de combustibles fósiles; consumir menos energía reduce las emisiones de gases de efecto invernadero."
  },
  {
    id: "challenge-5",
    number: 5,
    title: "Deja limpio un rinconcito de tu comunidad",
    shortTitle: "Limpieza comunitaria",
    category: "community",
    categoryLabel: "Mi comunidad",
    difficulty: "Avanzado",
    duration: "45-60 min",
    icon: "🧤",
    summary: "Recoge la basura de una acera, parque o parada de bus y déjalo como nuevo.",
    instruction: "Equípate con guantes reutilizables y bolsas para residuos. Escoge un tramo de acera, área verde o parque de tu comunidad y recoge plásticos, colillas de cigarro y latas. Si es posible, invita a un vecino o familiar a sumarse.",
    concreteActions: [
      "Lleva guantes de protección y recipiente seguro para objetos punzocortantes.",
      "Separa los plásticos y latas reciclables recogidos de la basura común.",
      "Toma una foto de antes y después para motivar a tu vecindario en los foros de ECRA."
    ],
    whyItMatters: "Un espacio público limpio fomenta el respeto comunitario, la convivencia saludable y previene que los desechos obstruyan alcantarillas."
  },
  {
    id: "challenge-6",
    number: 6,
    title: "Un día sin plásticos de un solo uso",
    shortTitle: "Consumo responsable",
    category: "consumption",
    categoryLabel: "Compras con cabeza",
    difficulty: "Principiante",
    duration: "Todo el día",
    icon: "🛍️",
    summary: "Haz tus compras del día sin bolsas, pajillas ni botellas desechables.",
    instruction: "Durante al menos una semana completa, lleva siempre contigo tu bolsa de tela, una botella reutilizable de agua y un recipiente para alimentos cuando salgas. Elige productos locales, de temporada y evita envases innecesarios.",
    concreteActions: [
      "Di activamente 'sin bolsa plástica, por favor' en el comercio local.",
      "Prefiere productos de agricultores y emprendedores locales de tu cantón o provincia.",
      "Planifica tu menú semanal para no comprar comida de más que termine descomponiéndose."
    ],
    whyItMatters: "El mejor residuo es aquel que no se produce. Reducir desde la compra disminuye drásticamente la demanda de plásticos vírgenes."
  },
  {
    id: "challenge-7",
    number: 7,
    title: "Empieza tu abono casero (compost)",
    shortTitle: "Compostaje y suelo",
    category: "waste",
    categoryLabel: "Compost y tierra",
    difficulty: "Intermedio",
    duration: "30-40 min",
    icon: "🌱",
    summary: "Convierte cáscaras de fruta y restos de verdura en abono para tus plantas.",
    instruction: "Aparta un balde con tapa o espacio en tu jardin para iniciar compostaje. Coloca una base de hojas secas o aserrín (material marrón) y agrega cáscaras de vegetales, restos de café y frutas (material verde). Mantén la mezcla húmeda pero aireada.",
    concreteActions: [
      "No agregues carnes, lácteos ni aceites para evitar malos olores o fauna no deseada.",
      "Mantén la proporción equilibrada: 2 partes de hojas secas por cada parte de restos frescos.",
      "Revuelve semanalmente para oxigenar los microorganismos que descomponen la materia."
    ],
    whyItMatters: "Más del 50% de la basura doméstica es orgánica. Al compostar se evita la generación de gas metano en los vertederos y se nutre la tierra."
  },
  {
    id: "challenge-8",
    number: 8,
    title: "Cuéntales a tus amigos y familia",
    shortTitle: "Educación ambiental",
    category: "education",
    categoryLabel: "Hablemos del ambiente",
    difficulty: "Principiante",
    duration: "30 min",
    icon: "🗣️",
    summary: "Conversa con tu familia, amigos o compañeros de tu centro educativo sobre cómo cuidar el ambiente.",
    instruction: "Conversa con al menos dos personas cercanas sobre una práctica ecológica sencilla que puedan adoptar juntos (como separar residuos o ahorrar agua). También puedes compartir una publicación informativa en los foros de ECRA o en tus redes sociales personales.",
    concreteActions: [
      "Explica de forma positiva por qué te importa el cuidado del planeta sin juzgar a otros.",
      "Comparte una receta de aprovechamiento de alimentos o un consejo de ahorro energético.",
      "Invita a un amigo o colega a registrarse en ECRA para realizar una misión en conjunto."
    ],
    whyItMatters: "El cambio cultural empieza con conversaciones honestas y cotidianas. La educación ambiental compartida multiplica el impacto colectivo."
  },
  {
    id: "challenge-9",
    number: 9,
    title: "La broza al compost: aprovecha restos de la broza de tu café",
    shortTitle: "Broza al compost",
    category: "waste",
    categoryLabel: "Compost y tierra",
    difficulty: "Principiante",
    duration: "20-30 min",
    icon: "☕",
    summary: "Utiliza el desecho de la broza de tu café como material organico en tu compostera.",
    instruction: "Junta la broza con cascaras de huevo que normalmente se tira y vuelve esos desechos en nutrientes para tus plantas. Úsala como material organico y extiéndelo como cobertura alrededor de tus plantas para conservar la humedad.",
    concreteActions: [
      "Combina la broza del cafe que compras con cascaras de huevo, al triturarlas tendras compost orgánico.",
      "Almacenalo en algun recipiente con tapa, siempre procurando evitar moscas y otros insectos busquen hospedarse en tu compost organico.",
      "No envies esos desechos que pueden dar nutrientes a tus plantas a contenedores de basura."
    ],
    whyItMatters: "Quemar o botar la broza desperdicia un recurso gratuito. Convertirla en compost devuelve nutrientes al suelo, retiene agua y evita humo y residuos en el vertedero."
  },
  {
    id: "challenge-10",
    number: 10,
    title: "Mini huerta en casa: siembra tus aromáticas y hortalizas",
    shortTitle: "Huerta casera",
    category: "consumption",
    categoryLabel: "Huerta y comida",
    difficulty: "Intermedio",
    duration: "40 min",
    icon: "🥬",
    summary: "Siembra culantro, albahaca, chile o lechuga en macetas, botellas o un cantero pequeño.",
    instruction: "Reutiliza envases (botellas cortadas, baldes, cajas de madera) para armar una pequeña huerta. Llénalos con tierra mezclada con compost, siembra al menos dos especies que consumas en casa y colócalos donde reciban buena luz. Riega con agua reutilizada cuando sea posible.",
    concreteActions: [
      "Haz agujeros de drenaje en el fondo de cada envase para evitar que se pudran las raíces.",
      "Elige plantas fáciles: culantro, albahaca, hierbabuena, lechuga o chile dulce.",
      "Anota la fecha de siembra y toma una foto cada semana para ver cómo crece."
    ],
    whyItMatters: "Cultivar aunque sea una parte de lo que comes reduce empaques y transporte, y te acerca al origen real de los alimentos."
  },
  {
    id: "challenge-11",
    number: 11,
    title: "Aceite de cocina usado: guárdalo, no lo viertas",
    shortTitle: "Aceite usado",
    category: "water",
    categoryLabel: "Agua y nacientes",
    difficulty: "Principiante",
    duration: "15 min",
    icon: "🛢️",
    summary: "Evita que el aceite usado termine en el desagüe y llévalo a un punto de recolección.",
    instruction: "Deja enfriar por completo el aceite que usaste para cocinar, fíltralo con un colador y guárdalo en una botella plástica con tapa. Investiga si en tu comunidad, municipalidad o comercio cercano reciben aceite usado, y acuérdate de entregarlo cuando se llene.",
    concreteActions: [
      "Nunca viertas el aceite en el fregadero, el lavamanos ni el suelo.",
      "Limpia las sartenes con papel o un trapo antes de lavarlas para que no entre grasa al desagüe.",
      "Pregunta en tu centro educativo o comunidad si existe un punto de acopio o si se puede organizar uno."
    ],
    whyItMatters: "Un solo litro de aceite puede contaminar miles de litros de agua y obstruir tuberías y alcantarillas."
  },
  {
    id: "challenge-12",
    number: 12,
    title: "Segunda vida: reutiliza frascos, botellas y envases",
    shortTitle: "Reutilizar envases",
    category: "waste",
    categoryLabel: "Reciclaje y basura",
    difficulty: "Principiante",
    duration: "30 min",
    icon: "🫙",
    summary: "Convierte envases que ibas a botar en organizadores, macetas, lámparas o recipientes de almacenamiento.",
    instruction: "Escoge tres envases limpios (frascos de vidrio, botellas plásticas, latas con bordes lisos) y dales un nuevo uso en casa: porta lápices, macetas, recipientes para granos, comederos para aves o botes para tornillos. Documenta el antes y el después.",
    concreteActions: [
      "Lava bien los envases y retira las etiquetas con agua tibia.",
      "Lija o cubre los bordes filosos de latas y vidrio antes de usarlos.",
      "Comparte tu idea en los foros de ECRA para inspirar a otras personas."
    ],
    whyItMatters: "Reutilizar alarga la vida de los materiales y evita el gasto de energía y recursos que implica fabricar o reciclar un envase nuevo."
  },
  {
    id: "challenge-13",
    number: 13,
    title: "Cosecha de agua de lluvia en casa",
    shortTitle: "Agua de lluvia",
    category: "water",
    categoryLabel: "Agua y nacientes",
    difficulty: "Avanzado",
    duration: "45-60 min",
    icon: "🌧️",
    summary: "Instala un sistema sencillo para recoger agua de lluvia y usarla para regar o limpiar.",
    instruction: "Coloca un balde o barril con tapa o malla bajo una canoa, bajante o borde del techo para captar agua de lluvia. Úsala para regar plantas, lavar patios o limpiar. Mantén el recipiente siempre tapado para evitar criaderos de mosquitos.",
    concreteActions: [
      "Cubre el recipiente con malla fina o tapa para impedir que los zancudos pongan huevos.",
      "Vacía y lava el recipiente cada cierto tiempo si no se usa el agua.",
      "No uses esta agua para beber ni cocinar sin un tratamiento adecuado."
    ],
    whyItMatters: "Aprovechar la lluvia reduce la presión sobre el agua potable, que es limitada y se trata con energía y recursos."
  },
  {
    id: "challenge-14",
    number: 14,
    title: "Detective del recibo: descubre cuánta agua usas",
    shortTitle: "Recibo de agua",
    category: "water",
    categoryLabel: "Agua y nacientes",
    difficulty: "Principiante",
    duration: "25 min",
    icon: "🧾",
    summary: "Lee el medidor o el recibo de agua, identifica dónde se te va más y fíjate una meta de ahorro.",
    instruction: "Revisa el consumo de tu último recibo de agua o lee el medidor antes y después de un día normal. Identifica las tres actividades que más gastan (ducha, lavado de ropa, riego) y elige una meta realista de reducción para los próximos siete días.",
    concreteActions: [
      "Cierra todas las llaves y verifica si el medidor sigue girando: puede indicar una fuga oculta.",
      "Usa un balde para recoger el agua fría mientras sale la caliente y úsala para regar o limpiar.",
      "Comparte con tu familia la meta y revisen juntos el siguiente recibo."
    ],
    whyItMatters: "Medir es el primer paso para ahorrar: sin datos es difícil saber dónde se desperdicia el agua."
  },
  {
    id: "challenge-15",
    number: 15,
    title: "Tendedero solar: seca tu ropa al sol",
    shortTitle: "Secado al sol",
    category: "energy",
    categoryLabel: "Luz y energía",
    difficulty: "Principiante",
    duration: "Todo el día",
    icon: "☀️",
    summary: "Evita la secadora durante una semana y aprovecha el sol y el viento para secar la ropa.",
    instruction: "Durante siete días seguidos, seca tu ropa en un tendedero al aire libre o en un espacio ventilado en lugar de usar secadora eléctrica. Si no tienes secadora, ayuda a otras personas de tu hogar a organizar un espacio de secado que funcione también en días lluviosos.",
    concreteActions: [
      "Sacude la ropa antes de colgarla para que se seque más rápido y quede con menos arrugas.",
      "Cuelga primero las prendas más gruesas, en las zonas con más sol y ventilación.",
      "Si llueve, usa un tendedero interior cerca de una ventana abierta."
    ],
    whyItMatters: "El sol seca gratis y sin emisiones. La secadora es uno de los electrodomésticos que más electricidad consume."
  },
  {
    id: "challenge-16",
    number: 16,
    title: "Cocina eficiente: menos gas, menos electricidad",
    shortTitle: "Cocina eficiente",
    category: "energy",
    categoryLabel: "Luz y energía",
    difficulty: "Principiante",
    duration: "Todo el día",
    icon: "🍳",
    summary: "Adopta hábitos sencillos al cocinar para gastar menos energía sin cambiar tu menú.",
    instruction: "Durante una semana, cocina con tapa, usa ollas del tamaño adecuado al fuego, descongela con anticipación y aprovecha el calor residual al apagar. Si es posible, cocina varios alimentos a la vez y evita abrir el horno sin necesidad.",
    concreteActions: [
      "Tapa siempre las ollas: el agua hierve más rápido y se gasta menos energía.",
      "Apaga el fuego unos minutos antes de terminar y deja que el calor residual termine la cocción.",
      "Descongela los alimentos en el refrigerador la noche anterior."
    ],
    whyItMatters: "Cocinar representa una parte importante del consumo energético del hogar. Pequeños hábitos reducen gasto y emisiones."
  },
  {
    id: "challenge-17",
    number: 17,
    title: "Un día sin carro: camina, pedalea o comparte el viaje",
    shortTitle: "Movilidad sostenible",
    category: "energy",
    categoryLabel: "Moverse mejor",
    difficulty: "Intermedio",
    duration: "Todo el día",
    icon: "🚲",
    summary: "Elige caminar, usar bicicleta, transporte público o compartir vehículo en tus traslados de un día.",
    instruction: "Escoge un día y planifica tus trayectos para no usar carro ni moto de manera individual: camina las distancias cortas, usa bicicleta o transporte público, o comparte el viaje con otras personas. Toma nota de lo que descubres en el camino.",
    concreteActions: [
      "Revisa con anticipación horarios y rutas de bus o la ruta más segura para caminar o pedalear.",
      "Agrupa mandados para hacer menos viajes.",
      "Respeta siempre las normas de tránsito, usa casco y ropa visible si vas en bicicleta."
    ],
    whyItMatters: "El transporte es una fuente importante de emisiones; moverse de forma distinta también mejora la salud y reduce el ruido y la congestión."
  },
  {
    id: "challenge-18",
    number: 18,
    title: "Tarde sin pantallas: conecta con la naturaleza",
    shortTitle: "Desconexión digital",
    category: "education",
    categoryLabel: "Pantallas y naturaleza",
    difficulty: "Principiante",
    duration: "1-2 horas",
    icon: "📵",
    summary: "Apaga las pantallas un rato y dedica ese tiempo a observar, cuidar o disfrutar tu entorno natural.",
    instruction: "Reserva una tarde libre de pantallas recreativas y úsala para una actividad ambiental: caminar por un sendero o parque, regar tu huerta, observar aves o recoger residuos. Al volver, anota qué notaste que normalmente se te pasa por alto.",
    concreteActions: [
      "Avisa a tu familia o amistades para que sepan que estarás desconectado/a un rato.",
      "Lleva una libreta para anotar lo que ves, oyes y sientes.",
      "Comparte tu experiencia después en los foros de ECRA o con tus amigos."
    ],
    whyItMatters: "Reducir el uso excesivo de aparatos electrónicos y volver a mirar nuestro entorno nos ayuda a comprender mejor lo que queremos cuidar."
  },
  {
    id: "challenge-19",
    number: 19,
    title: "Residuos electrónicos: dales el destino correcto",
    shortTitle: "Residuos electrónicos",
    category: "waste",
    categoryLabel: "Reciclaje y basura",
    difficulty: "Intermedio",
    duration: "30-40 min",
    icon: "🔋",
    summary: "Reúne pilas, cargadores y aparatos en desuso y averigua dónde entregarlos de forma segura.",
    instruction: "Haz un inventario de pilas gastadas, cables, cargadores, celulares viejos y pequeños aparatos que ya no uses. Guárdalos en una caja aparte (nunca en la basura común) e investiga qué centros de acopio, campañas o empresas de tu zona reciben residuos electrónicos.",
    concreteActions: [
      "Guarda las pilas en un recipiente no metálico y seco, y no las perfores ni las quemes.",
      "Antes de entregar un celular o computadora, respalda y borra tu información personal.",
      "Si algo aún funciona, considera donarlo o repararlo antes de desecharlo."
    ],
    whyItMatters: "Los aparatos electrónicos contienen materiales valiosos y sustancias contaminantes; un manejo correcto evita que dañen el suelo y el agua."
  },
  {
    id: "challenge-20",
    number: 20,
    title: "Ropa con segunda oportunidad: repara, intercambia o dona",
    shortTitle: "Ropa circular",
    category: "consumption",
    categoryLabel: "Compras con cabeza",
    difficulty: "Intermedio",
    duration: "45 min",
    icon: "👕",
    summary: "Da nueva vida a tu ropa en lugar de desecharla: remienda, intercambia o dona.",
    instruction: "Revisa tu clóset y separa tres grupos: prendas que se pueden arreglar, prendas en buen estado que ya no usas y trapos aprovechables. Repara lo que puedas, organiza un intercambio con amistades o familia, y dona lo demás a alguien que lo necesite.",
    concreteActions: [
      "Aprende un arreglo básico: coser un botón, un dobladillo o un pequeño roto.",
      "Convierte camisetas muy gastadas en trapos de limpieza o bolsas de tela.",
      "Antes de comprar ropa nueva, pregúntate si realmente la necesitas."
    ],
    whyItMatters: "Producir ropa requiere grandes cantidades de agua, energía y materias primas; alargar su vida útil reduce ese impacto."
  },
  {
    id: "challenge-21",
    number: 21,
    title: "Cero desperdicio: cocina con lo que ya tienes",
    shortTitle: "Cero desperdicio de alimentos",
    category: "consumption",
    categoryLabel: "Huerta y comida",
    difficulty: "Principiante",
    duration: "40 min",
    icon: "🥘",
    summary: "Prepara una comida aprovechando sobras, frutas maduras o verduras que estaban por echarse a perder.",
    instruction: "Revisa tu refrigerador y despensa e identifica los alimentos que se deben consumir primero. Planifica y cocina una comida (sopa, arroz, picadillo, batido o pan) que los aproveche. Guarda las sobras en recipientes con fecha.",
    concreteActions: [
      "Usa primero lo que vence antes: ordena el refrigerador con lo más antiguo al frente.",
      "Aprovecha tallos, cáscaras limpias y frutas muy maduras en caldos, jugos o postres.",
      "Lo que no pueda comerse (cáscaras, restos vegetales) llévalo a tu compost."
    ],
    whyItMatters: "Cuando se desperdicia comida también se desperdician el agua, la tierra y la energía que se usaron para producirla."
  },
  {
    id: "challenge-22",
    number: 22,
    title: "Siembra un árbol nativo",
    shortTitle: "Árbol nativo",
    category: "wildlife",
    categoryLabel: "Plantas y animales",
    difficulty: "Avanzado",
    duration: "1 hora",
    icon: "🌳",
    summary: "Planta un árbol de una especie nativa de tu zona en un lugar adecuado y comprométete a cuidarlo.",
    instruction: "Consigue una semilla de especie nativa en un vivero local, comunidad o programa de reforestación. Elige con permiso un lugar adecuado, lejos de cables y tuberías, haz un hueco amplio, siembra con cuidado, riégalo y marca el sitio para darle seguimiento.",
    concreteActions: [
      "Consulta en un vivero o con una persona experta qué especies nativas se adaptan a tu zona.",
      "Pide autorización si vas a sembrar en un espacio comunal o público.",
      "Riega periódicamente y retira la maleza alrededor durante los primeros meses."
    ],
    whyItMatters: "Los árboles nativos dan alimento y refugio a la fauna local, protegen el suelo y ayudan a regular el agua y la temperatura."
  },
  {
    id: "challenge-23",
    number: 23,
    title: "Conteo de fauna en tu patio o comunidad",
    shortTitle: "Conteo de fauna",
    category: "wildlife",
    categoryLabel: "Plantas y animales",
    difficulty: "Intermedio",
    duration: "30 min",
    icon: "🐦",
    summary: "Observa durante 30 minutos y registra cuántas especies de fauna logras identificar.",
    instruction: "Elige un lugar tranquilo (patio, parque, ventana o camino) y observa durante 30 minutos en la mañana o al final de la tarde. Anota la fauna que veas o escuches, con su cantidad aproximada. Si no sabes el nombre, descríbelas o tómales una foto sin molestarlas.",
    concreteActions: [
      "Mantente quieto/a y en silencio para no espantar a la fauna.",
      "Usa una guía de fauna de tu país o una aplicación gratuita de identificación.",
      "Repite el conteo en otra época del año y compara los resultados."
    ],
    whyItMatters: "Conocer la fauna de tu entorno es una forma sencilla de valorar la biodiversidad y detectar cambios en el ecosistema."
  },
  {
    id: "challenge-24",
    number: 24,
    title: "Ecoladrillo: encierra plástico limpio en una botella",
    shortTitle: "Ecoladrillo",
    category: "waste",
    categoryLabel: "Reciclaje y basura",
    difficulty: "Intermedio",
    duration: "Varios días",
    icon: "🧱",
    summary: "Rellena una botella con plásticos blandos limpios y secos para fabricar un ladrillo reutilizable.",
    instruction: "Junta empaques plásticos blandos (bolsas, envolturas) bien limpios y secos. Córtalos en trozos y compáctalos dentro de una botella plástica con ayuda de un palo hasta que quede firme. Úsala en un proyecto comunitario o entrégala a una iniciativa que los reciba.",
    concreteActions: [
      "Asegúrate de que el plástico esté completamente seco para evitar humedad y moho dentro de la botella.",
      "Compacta por capas con un palo de madera hasta que la botella quede dura.",
      "Averigua si en tu comunidad hay un proyecto que construya con ecoladrillos."
    ],
    whyItMatters: "Sirve para dar un uso útil a plásticos que normalmente no se reciclan, aunque lo ideal siempre será consumir menos plástico."
  },
  {
    id: "challenge-25",
    number: 25,
    title: "Caminata de limpieza en una quebrada, río o playa",
    shortTitle: "Limpieza de quebrada",
    category: "community",
    categoryLabel: "Mi comunidad",
    difficulty: "Avanzado",
    duration: "1-2 horas",
    icon: "🌊",
    summary: "Organiza o únete a una jornada para retirar basura de las orillas de un cuerpo de agua.",
    instruction: "Reúne a un grupo, lleven guantes, bolsas y recipientes para clasificar lo que recojan. Eviten entrar al agua o zonas inseguras y trabajen solo en las orillas accesibles. Separen reciclables, ordinarios y objetos peligrosos, y registren qué tipo de residuo es el más frecuente.",
    concreteActions: [
      "Avisa a un adulto o a la autoridad local, y no vayas solo/a.",
      "No recojas vidrios rotos, jeringas ni residuos peligrosos con las manos: repórtalos con un adulto.",
      "Toma fotos del antes y el después y publícalas en los foros de ECRA."
    ],
    whyItMatters: "La basura que llega a quebradas y ríos termina en el mar, afecta la vida acuática y contamina el agua que usan muchas comunidades."
  },
  {
    id: "challenge-26",
    number: 26,
    title: "Limpiadores caseros: menos químicos en el desagüe",
    shortTitle: "Limpieza natural",
    category: "water",
    categoryLabel: "Agua y nacientes",
    difficulty: "Intermedio",
    duration: "30 min",
    icon: "🧴",
    summary: "Prepara un limpiador sencillo con ingredientes cotidianos para reducir productos agresivos.",
    instruction: "Prepara un limpiador multiusos con ingredientes básicos de cocina (por ejemplo, vinagre diluido en agua o bicarbonato de sodio) y úsalo para limpiar superficies. Reutiliza un envase con atomizador y rotúlalo claramente.",
    concreteActions: [
      "Nunca mezcles vinagre con cloro ni con otros productos de limpieza: pueden generar gases peligrosos.",
      "Rotula el envase y guárdalo fuera del alcance de niños y mascotas.",
      "Prueba el limpiador primero en una zona pequeña, sobre todo en superficies delicadas."
    ],
    whyItMatters: "Reducir químicos fuertes que van al desagüe protege las fuentes de agua y la salud de quienes limpian."
  },
  {
    id: "challenge-27",
    number: 27,
    title: "Lleva ECRA a tu escuela, colegio o grupo",
    shortTitle: "ECRA en tu institución",
    category: "education",
    categoryLabel: "Hablemos del ambiente",
    difficulty: "Avanzado",
    duration: "30-45 min",
    icon: "🏫",
    summary: "Presenta una misión de ECRA a tu grupo y propongan una acción conjunta.",
    instruction: "Conversa con un docente, directivo o líder de tu grupo y propón dedicar un espacio corto para presentar una misión ambiental. Elijan juntos una acción para hacer en grupo (por ejemplo, un punto de reciclaje o una limpieza) y definan quién se encarga de qué.",
    concreteActions: [
      "Prepara una explicación breve de máximo 10 minutos sobre qué es ECRA y cómo participar.",
      "Propón una misión concreta que el grupo pueda completar en una semana.",
      "Acuerden una forma de compartir los resultados con otras personas de la institución."
    ],
    whyItMatters: "Las instituciones educativas y los grupos de interés común multiplican el alcance de las acciones y llegan a quienes no tienen acceso directo a internet."
  },
  {
    id: "challenge-28",
    number: 28,
    title: "Misión sin internet: un mural ambiental para tu comunidad",
    shortTitle: "Mural sin conexión",
    category: "education",
    categoryLabel: "Hablemos del ambiente",
    difficulty: "Avanzado",
    duration: "1 hora",
    icon: "📌",
    summary: "Crea un cartel o mural informativo con un consejo ambiental para quienes no tienen conexión a internet.",
    instruction: "Elabora en papel, cartón reutilizado o una pared autorizada un cartel con un consejo ambiental práctico (separar residuos, ahorrar agua o compostar). Colócalo en un lugar visible de tu comunidad, escuela o comercio, con permiso, y comparte un mensaje claro y positivo.",
    concreteActions: [
      "Usa materiales reutilizados: cartón, hojas usadas por un lado o pintura que te sobre.",
      "Escribe un mensaje corto, con letra grande y un dibujo que se entienda de lejos.",
      "Incluye una invitación a participar en ECRA o a unirse a una misión grupal."
    ],
    whyItMatters: "No todos los hogares tienen internet; llevar la información al espacio físico hace que el cuidado ambiental llegue a más personas."
  }
];

export const FORUM_CATEGORIES = {
  campaign: { label: "Campañas ecológicas", icon: "", description: "Jornadas, firmas, reforestación y actividades colectivas." },
  problem: { label: "Problemas ambientales de mi comunidad", icon: "", description: "Denuncias constructivas, vertederos clandestinos y puntos críticos." },
  project: { label: "Proyectos sostenibles", icon: "", description: "Iniciativas en marcha que requieren voluntarios o apoyo vecinal." },
  wildlife: { label: "Protección de flora y fauna", icon: "", description: "Cuidado de especies nativas, rescate y siembra comunitaria." },
  waste: { label: "Reciclaje y contaminación", icon: "", description: "Centros de acopio, compostaje comunitario y reducción de plásticos." },
  water: { label: "Agua y conservación de nacientes", icon: "", description: "Cuidado de ríos, cuencas, quebradas y acueductos comunales." },
  education: { label: "Educación ambiental", icon: "", description: "Talleres, charlas, guías didácticas y recursos escolares." },
  idea: { label: "Ideas y propuestas ciudadanas", icon: "", description: "Propuestas innovadoras para mejorar comunidades y ciudades." },
  general: { label: "General", icon: "", description: "Cualquier otro tema ambiental y comunitario." }
};

// Estados oficiales de iniciativas en foros
export const FORUM_STATUSES = {
  proposal: { label: "Propuesta", class: "status-neutral", badge: "Propuesta" },
  planning: { label: "En planificación", class: "status-pending", badge: "En planificación" },
  development: { label: "En desarrollo", class: "status-progress", badge: "En desarrollo" },
  completed: { label: "Finalizada", class: "status-approved", badge: "Finalizada" }
};

// Tipos de publicaciones
export const FORUM_TYPES = {
  idea: { label: "Idea", icon: "" },
  campaign: { label: "Campaña", icon: "" },
  problem: { label: "Problema", icon: "" },
  project: { label: "Proyecto", icon: "" }
};

// Opciones de colaboración voluntaria
export const CONTRIBUTION_OPTIONS = [
  { id: "hands", label: "Manos a la obra / Trabajo en terreno", icon: "" },
  { id: "ideas", label: "Aporte de ideas y planificación técnica", icon: "" },
  { id: "materials", label: "Donación o préstamo de herramientas/materiales", icon: "" },
  { id: "diffusion", label: "Difusión, comunicación y redes sociales", icon: "" },
  { id: "other", label: "Otra forma de apoyo", icon: "" }
];

// Promesa para verificar el estado inicial de Auth
const authReady = new Promise(resolve => {
  const stop = onAuthStateChanged(auth, user => {
    stop();
    resolve(user || null);
  });
});

export async function waitForAuth() {
  return authReady;
}

export function nowISO() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

export function formatDate(date) {
  if (!date) return "—";
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(d);
}

export function formatDateShort(date) {
  if (!date) return "—";
  const d = date?.toDate ? date.toDate() : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
}

export function timeValue(value) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[c]));
}

export function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

export function isConfiguredAdmin(userOrProfile) {
  // Acepta un objeto con .email (usuario o perfil) o directamente el correo como texto.
  const raw = typeof userOrProfile === "string" ? userOrProfile : (userOrProfile?.email || "");
  return normalize(raw) === normalize(ADMIN_EMAIL);
}

// Asegura que exista el perfil en Cloud Firestore y mantiene el rol admin sincronizado
export async function ensureUserProfile(user, preferredName = "") {
  if (!user?.uid) return null;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const admin = isConfiguredAdmin(user);

  if (!snap.exists()) {
    const profile = {
      firebaseUid: user.uid,
      name: preferredName || user.displayName || user.email?.split("@")[0] || "Participante ECRA",
      email: user.email || "",
      role: admin ? "admin" : "participant",
      currentChallenge: 1,
      completed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, profile);
    return { id: user.uid, ...profile, createdAt: nowISO(), updatedAt: nowISO() };
  }

  const existing = snap.data();
  const patch = { updatedAt: serverTimestamp() };
  if (preferredName || user.displayName) patch.name = preferredName || user.displayName;
  if (user.email && existing.email !== user.email) patch.email = user.email;
  if (admin && existing.role !== "admin") patch.role = "admin";

  if (Object.keys(patch).length > 1 || (admin && existing.role !== "admin")) {
    await updateDoc(ref, patch);
  }

  return { id: user.uid, ...existing, ...patch, role: admin ? "admin" : (patch.role || existing.role) };
}

export async function getCurrentProfile() {
  const user = await waitForAuth();
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return ensureUserProfile(user);
  const data = snap.data();
  // Si el correo es el de la cuenta administradora, el rol siempre es "admin", aunque el
  // documento viejo en Firestore diga "participant". Antes esto sacaba al admin del panel.
  if (isConfiguredAdmin(user) && data.role !== "admin") {
    try {
      await updateDoc(doc(db, "users", user.uid), { role: "admin", updatedAt: serverTimestamp() });
    } catch (error) {
      console.warn("No se pudo guardar el rol de administrador:", error);
    }
    return { id: snap.id, ...data, role: "admin" };
  }
  return { id: snap.id, ...data };
}

export async function requireParticipant() {
  const user = await waitForAuth();
  if (!user) {
    window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }
  const profile = await getCurrentProfile();
  return profile;
}

export async function requireAdmin() {
  const user = await waitForAuth();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  let profile = null;
  try {
    profile = await getCurrentProfile();
  } catch (error) {
    console.error("No se pudo leer el perfil de administración:", error);
  }
  const isAdmin = isConfiguredAdmin(user) || profile?.role === "admin";
  if (!isAdmin) {
    window.location.href = "profile.html";
    return null;
  }
  // Perfil mínimo por si Firestore tardó o falló al leer el documento del admin.
  profile = { name: user.displayName || user.email?.split("@")[0] || "Admin", email: user.email || "", ...(profile || {}), role: "admin" };
  return { user, profile };
}

export async function signOutAndGoLogin() {
  try {
    await signOut(auth);
  } finally {
    window.location.href = "login.html";
  }
}

// Sistema de notificaciones toast profesional
export function showToast(message, type = "info") {
  let root = document.getElementById("toastRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "toastRoot";
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.setAttribute("role", "status");
  item.textContent = message;
  root.appendChild(item);

  // Animación de entrada y auto-eliminación
  requestAnimationFrame(() => item.classList.add("visible"));
  setTimeout(() => {
    item.classList.remove("visible");
    setTimeout(() => item.remove(), 250);
  }, 3400);
}

export function openModal(html) {
  let root = document.getElementById("modalRoot") || document.getElementById("adminModalRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "modalRoot";
    document.body.appendChild(root);
  }

  const hasOverlay = /class="[^"]*\bmodal-overlay\b/.test(html);
  root.innerHTML = hasOverlay
    ? html
    : `<div class="modal-overlay" data-close-modal><div class="modal-dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  root.setAttribute("aria-hidden", "false");

  const escHandler = (e) => {
    if (e.key === "Escape") close();
  };

  function close() {
    root.innerHTML = "";
    root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  document.body.style.overflow = "hidden";
  root.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", close));
  root.querySelectorAll("[data-close-modal]").forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) close();
    });
  });
  document.addEventListener("keydown", escHandler);

  // Enfoca el primer campo para poder escribir de inmediato
  const firstField = root.querySelector("input:not([type=hidden]), textarea, select");
  if (firstField) setTimeout(() => firstField.focus({ preventScroll: true }), 60);

  return { close, root };
}

// Gestión del tema claro/oscuro
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute("aria-label", theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    btn.title = theme === "dark" ? "Activar modo claro" : "Activar modo oscuro";
  });
}

export function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  applyTheme(stored || preferred);

  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "light";
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
      markThemeToggled();
    });
  });

  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", event => {
    if (localStorage.getItem(THEME_KEY)) return;
    applyTheme(event.matches ? "dark" : "light");
  });
}

// Inicialización inmediata del tema para evitar parpadeos
(function bootTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    const preferred = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
    document.documentElement.dataset.theme = stored || preferred;
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();

// Soporte para mostrar/ocultar contraseñas
export function togglePasswordVisibility() {
  document.querySelectorAll("[data-toggle-password]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-toggle-password");
      const input = document.getElementById(targetId);
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "Mostrar" : "Ocultar";
      btn.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
    });
  });
}

// Conexión del botón de logout
export function wireLogout() {
  document.querySelectorAll("#logoutBtn, #adminLogoutBtn, [data-logout]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await signOutAndGoLogin();
      } catch (err) {
        console.error("Error al salir:", err);
        btn.disabled = false;
      }
    });
  });
}

// Actualiza dinámicamente el header según si el usuario está autenticado
export function syncNavigationHeader(user, profile) {
  const navLinksContainer = document.querySelector(".nav-links");
  if (!navLinksContainer) return;

  // Si estamos en admin.html dejamos la navegación lateral del panel intacta
  if (document.body.classList.contains("admin-page")) return;

  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  let html = `
    <a class="nav-link ${currentPath === "index.html" || currentPath === "" ? "active" : ""}" href="index.html">Inicio</a>
    <a class="nav-link ${currentPath === "challenges.html" || currentPath === "challenge.html" ? "active" : ""}" href="challenges.html">Retos Ecológicos</a>
    <a class="nav-link ${currentPath === "missions.html" ? "active" : ""}" href="missions.html">Misiones</a>
    <a class="nav-link ${currentPath === "forums.html" ? "active" : ""}" href="forums.html">Foros Comunitarios</a>
    <a class="nav-link ${currentPath === "ranking.html" ? "active" : ""}" href="ranking.html">Clasificación</a>
  `;

  if (user) {
    // Un fallo temporal al leer el perfil no debe volver a mostrar accesos de visitante.
    const displayName = profile?.name || user.displayName || user.email?.split("@")[0] || "Mi perfil";
    if (profile?.role === "admin" || isConfiguredAdmin(user)) {
      html += `<a class="nav-link ${currentPath === "admin.html" ? "active" : ""}" href="admin.html">Panel admin</a>`;
    }
    html += `
      <a class="nav-link user-pill ${currentPath === "profile.html" ? "active" : ""}" href="profile.html">
        ${avatarHTML(displayName, cosmeticsFromUser(profile), { size: "sm", coreClass: "user-pill-avatar" })}
        <span>${escapeHTML(displayName.split(" ")[0] || "Mi perfil")}</span>
      </a>
      <button id="logoutBtn" class="btn btn-ghost btn-sm" type="button" data-logout>Cerrar sesión</button>
    `;
  } else {
    html += `
      <a class="nav-link ${currentPath === "login.html" ? "active" : ""}" href="login.html" data-auth-guest>Iniciar sesión</a>
      <a class="btn btn-primary btn-sm" href="register.html" data-auth-guest>Participar</a>
    `;
  }

  navLinksContainer.innerHTML = html;
  wireLogout();
}

// Añade el menú móvil si no existe
export function initMobileNav() {
  const headerContent = document.querySelector(".header-content");
  const navLinks = document.querySelector(".nav-links");
  if (!headerContent || !navLinks) return;

  let toggle = document.querySelector(".mobile-menu-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.className = "mobile-menu-toggle";
    toggle.setAttribute("aria-label", "Abrir menú de navegación");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span class="hamburger-line"></span><span class="hamburger-line"></span><span class="hamburger-line"></span>`;
    headerContent.appendChild(toggle);
  }

  toggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.classList.toggle("active", isOpen);
  });

  // Cerrar al hacer clic en un enlace
  navLinks.querySelectorAll("a, button").forEach(item => {
    item.addEventListener("click", () => {
      navLinks.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.classList.remove("active");
    });
  });
}

// Funciones para las misiones guardadas en Firestore
export async function getUserChallengeStatus(userId) {
  if (!userId) return {};
  try {
    const snap = await getDocs(query(collection(db, "user_challenges"), where("userId", "==", userId)));
    const map = {};
    snap.docs.forEach(d => {
      const data = d.data();
      map[data.challengeId] = { id: d.id, ...data };
    });
    return map;
  } catch (error) {
    console.error("Error al obtener estado de misiones:", error);
    return {};
  }
}

export async function setChallengeProgress(userId, challengeId, status = "in_progress", notes = "") {
  if (!userId || !challengeId) return;
  const docId = `${userId}_${challengeId}`;
  const ref = doc(db, "user_challenges", docId);
  const snap = await getDoc(ref);

  const payload = {
    userId,
    challengeId,
    status,
    notes: notes || "",
    updatedAt: serverTimestamp()
  };

  if (status === "in_progress" && (!snap.exists() || !snap.data().startedAt)) {
    payload.startedAt = serverTimestamp();
  }
  if (status === "completed") {
    payload.completedAt = serverTimestamp();
  }

  await setDoc(ref, payload, { merge: true });

  // Actualizar contador del usuario
  try {
    const all = await getUserChallengeStatus(userId);
    all[challengeId] = { ...payload, status };
    const countCompleted = Object.values(all).filter(c => c.status === "completed").length;
    await updateDoc(doc(db, "users", userId), {
      completed: countCompleted,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn("No se pudo actualizar contador en users:", err);
  }
}

// Cálculo de estadísticas comunitarias con datos reales de Firestore
export async function getRealCommunityMetrics() {
  try {
    const [postsSnap, usersSnap, evidencesSnap] = await Promise.all([
      getDocs(collection(db, "forumPosts")).catch(() => ({ docs: [] })),
      getDocs(collection(db, "users")).catch(() => ({ docs: [] })),
      getDocs(collection(db, "evidences")).catch(() => ({ docs: [] }))
    ]);

    const activePosts = postsSnap.docs.filter(d => !d.data().deleted);
    const participants = usersSnap.docs.filter(d => d.data().role !== "admin");
    const completedChallengesCount = usersSnap.docs.reduce((acc, d) => {
      return acc + (Number(d.data().completed) || 0);
    }, 0);

    return {
      initiativesCount: activePosts.length,
      participantsCount: participants.length,
      challengesCompleted: completedChallengesCount,
      catalogCount: CHALLENGES.length
    };
  } catch (error) {
    console.error("Error al calcular métricas comunitarias:", error);
    return {
      initiativesCount: 0,
      participantsCount: 0,
      challengesCompleted: 0,
      catalogCount: CHALLENGES.length
    };
  }
}

async function trackActivity(user, profile) {
  if (!user?.uid || !profile) return profile;
  const patch = {};
  const local = {};
  const today = todayKey();

  if (profile.lastLoginDate !== today) {
    const streak = profile.lastLoginDate === yesterdayKey() ? (Number(profile.loginStreak) || 0) + 1 : 1;
    local.lastLoginDate = patch.lastLoginDate = today;
    local.loginStreak = patch.loginStreak = streak;
    local.bestStreak = patch.bestStreak = Math.max(Number(profile.bestStreak) || 0, streak);
    local.totalLogins = patch.totalLogins = (Number(profile.totalLogins) || 0) + 1;
  }

  const page = pageKeyFromPath();
  const visited = Array.isArray(profile.visitedPages) ? profile.visitedPages : [];
  if (page && !visited.includes(page)) {
    patch.visitedPages = arrayUnion(page);
    local.visitedPages = [...visited, page];
  }

  if (!Object.keys(patch).length) return profile;
  patch.updatedAt = serverTimestamp();
  await updateDoc(doc(db, "users", user.uid), patch);
  return { ...profile, ...local };
}

// Marca que la persona cambió de tema (misión "Modo luciérnaga")
export async function markThemeToggled() {
  const user = window.ECRA_AUTH_USER;
  const profile = window.ECRA_PROFILE;
  if (!user || !profile || profile.themeToggled) return;
  profile.themeToggled = true;
  try {
    await updateDoc(doc(db, "users", user.uid), { themeToggled: true, updatedAt: serverTimestamp() });
  } catch (error) {
    profile.themeToggled = false;
    console.warn("No se pudo registrar el cambio de tema:", error);
  }
}

// Registra que compartió ECRA hoy (cuenta una vez por día para evitar abusos)
export async function recordShare() {
  const user = window.ECRA_AUTH_USER;
  const profile = window.ECRA_PROFILE;
  if (!user || !profile) return { counted: false, days: 0 };
  const today = todayKey();
  const dates = Array.isArray(profile.shareDates) ? profile.shareDates : [];
  if (dates.includes(today)) return { counted: false, days: new Set(dates).size };
  await updateDoc(doc(db, "users", user.uid), { shareDates: arrayUnion(today), updatedAt: serverTimestamp() });
  profile.shareDates = [...dates, today];
  return { counted: true, days: new Set(profile.shareDates).size };
}

// Se resuelve cuando ya se conoce (o se descartó) el perfil de la sesión actual.
let resolveProfileReady;
export const profileReady = new Promise(resolve => { resolveProfileReady = resolve; });

// Escuchar cambios de Auth globalmente
onAuthStateChanged(auth, async user => {
  // Determina el estado cuanto antes para ocultar enlaces de acceso en todas las páginas.
  // La navegación completa se reconstruye después de resolver el perfil de Firestore.
  document.documentElement.dataset.authenticated = user ? "true" : "false";
  document.documentElement.dataset.authReady = "true";
  window.ECRA_AUTH_USER = user || null;
  if (user) {
    try {
      window.ECRA_PROFILE = await ensureUserProfile(user);
      try {
        window.ECRA_PROFILE = await trackActivity(user, window.ECRA_PROFILE);
      } catch (error) {
        console.warn("No se pudo registrar la actividad:", error);
      }
    } catch (error) {
      console.error("No se pudo sincronizar el perfil:", error);
      // Aunque Firestore falle, la cuenta admin debe seguir viendo su acceso al panel.
      window.ECRA_PROFILE = isConfiguredAdmin(user)
        ? { id: user.uid, name: user.displayName || user.email?.split("@")[0] || "Admin", email: user.email || "", role: "admin" }
        : null;
    }
  } else {
    window.ECRA_PROFILE = null;
  }
  syncNavigationHeader(window.ECRA_AUTH_USER, window.ECRA_PROFILE);
  resolveProfileReady(window.ECRA_PROFILE);
});

// Inicialización de DOM
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMobileNav();
  wireLogout();
  togglePasswordVisibility();
});

const SPOTLIGHT_SELECTOR = ".card, .pillar-card, .challenge-card, .post-card, .metric-card, .progress-card, .admin-stat-card";
const REVEAL_SELECTOR = ".pillar-card, .challenge-card, .post-card, .metric-item, .metric-card, .card, .banner-highlight, .filter-bar, .profile-hero-card, .empty-state";

function initSpotlight() {
  const move = (e) => {
    const el = e.target.closest?.(SPOTLIGHT_SELECTOR);
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerdown", move, { passive: true });
}

function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("rv-in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });

  const register = (root) => {
    const nodes = root.matches?.(REVEAL_SELECTOR) ? [root, ...root.querySelectorAll(REVEAL_SELECTOR)] : root.querySelectorAll(REVEAL_SELECTOR);
    let i = 0;
    nodes.forEach(el => {
      if (seen.has(el) || el.closest("#modalRoot, #adminModalRoot, .modal-overlay, #toastRoot")) return;
      seen.add(el);
      el.classList.add("rv");
      el.style.setProperty("--rv-delay", `${Math.min(i++, 6) * 70}ms`);
      io.observe(el);
    });
  };

  document.documentElement.classList.add("rv-ready");
  register(document.body);

  // Contenido que se inyecta después (misiones, publicaciones, vistas de admin…)
  new MutationObserver((mutations) => {
    mutations.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) register(n); }));
  }).observe(document.body, { childList: true, subtree: true });
}

document.addEventListener("DOMContentLoaded", () => {
  initSpotlight();
  initScrollReveal();
});

// Exposición en espacio de nombres ECRA
window.ECRA = {
  auth,
  db,
  CHALLENGES,
  FORUM_CATEGORIES,
  FORUM_STATUSES,
  FORUM_TYPES,
  CONTRIBUTION_OPTIONS,
  ADMIN_EMAIL,
  CONTACT_PHONE,
  CONTACT_EMAIL,
  waitForAuth,
  nowISO,
  uid,
  initials,
  formatDate,
  formatDateShort,
  timeValue,
  escapeHTML,
  isConfiguredAdmin,
  ensureUserProfile,
  getCurrentProfile,
  requireParticipant,
  requireAdmin,
  showToast,
  signOutAndGoLogin,
  applyTheme,
  openModal,
  getUserChallengeStatus,
  setChallengeProgress,
  getRealCommunityMetrics,
  recordShare,
  markThemeToggled,
  profileReady
};
