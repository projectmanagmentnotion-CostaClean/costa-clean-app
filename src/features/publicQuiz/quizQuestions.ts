export interface QuizOption {
  id: string
  label: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  topic: string
  options: QuizOption[]
  correctOptionId: string
  explanation: string
}

export const PASSING_PERCENTAGE = 80

export const gymManualQuizQuestions: QuizQuestion[] = [
  {
    id: 'q01',
    topic: 'Regla general',
    prompt: 'Si una superficie no aparece en el protocolo del manual, ¿qué debe hacer el trabajador?',
    correctOptionId: 'b',
    explanation: 'El manual prohíbe improvisar. Si hay duda, se debe seguir el protocolo indicado o consultar antes de aplicar productos.',
    options: [
      { id: 'a', label: 'Usar el químico más fuerte para asegurar la limpieza' },
      { id: 'b', label: 'No improvisar y seguir el protocolo indicado' },
      { id: 'c', label: 'Probar primero con lejía diluida' },
      { id: 'd', label: 'Limpiar solo con agua y terminar rápido' },
    ],
  },
  {
    id: 'q02',
    topic: 'Dosificación',
    prompt: '¿Cómo debe usarse el producto de limpieza en general?',
    correctOptionId: 'c',
    explanation: 'El manual insiste en usar poca cantidad para evitar residuos, daños y secados incorrectos.',
    options: [
      { id: 'a', label: 'En abundancia para que actúe más rápido' },
      { id: 'b', label: 'Solo mezclado con lejía' },
      { id: 'c', label: 'En poca cantidad y de forma controlada' },
      { id: 'd', label: 'Hasta dejar la superficie empapada' },
    ],
  },
  {
    id: 'q03',
    topic: 'Lejía',
    prompt: '¿Dónde permite el manual usar lejía?',
    correctOptionId: 'd',
    explanation: 'La lejía queda restringida a baños. No debe usarse en otras superficies delicadas o sensibles.',
    options: [
      { id: 'a', label: 'En pantallas de máquinas' },
      { id: 'b', label: 'En acero inoxidable y cristales' },
      { id: 'c', label: 'En mármol y cuarzo' },
      { id: 'd', label: 'Solo en baños' },
    ],
  },
  {
    id: 'q04',
    topic: 'Pantallas de máquinas',
    prompt: '¿Cómo se limpian las pantallas de máquinas del gimnasio?',
    correctOptionId: 'a',
    explanation: 'La instrucción es cero químicos: microfibra ligeramente húmeda y repaso con paño seco.',
    options: [
      { id: 'a', label: 'Con microfibra ligeramente húmeda y luego paño seco, sin químicos' },
      { id: 'b', label: 'Con limpiacristales y papel' },
      { id: 'c', label: 'Con desengrasante suave y esponja' },
      { id: 'd', label: 'Con lejía muy diluida y secado natural' },
    ],
  },
  {
    id: 'q05',
    topic: 'Pantallas de máquinas',
    prompt: '¿Qué cantidad de químico debe tocar una pantalla de máquina?',
    correctOptionId: 'c',
    explanation: 'La respuesta correcta es ninguna. El manual especifica cero químicos sobre pantallas.',
    options: [
      { id: 'a', label: 'Una pulverización ligera' },
      { id: 'b', label: 'Muy poca, solo en esquinas' },
      { id: 'c', label: 'Ninguna' },
      { id: 'd', label: 'Solo si la pantalla está muy sucia' },
    ],
  },
  {
    id: 'q06',
    topic: 'Baños generales',
    prompt: 'En baños generales, ¿qué criterio debe seguirse con los productos?',
    correctOptionId: 'b',
    explanation: 'Baños sí permiten lejía según el manual, pero cada zona debe tratarse con orden y sin mezclar productos sin control.',
    options: [
      { id: 'a', label: 'Usar el mismo producto para todo el local' },
      { id: 'b', label: 'Aplicar el producto correcto por zona y mantener orden de limpieza' },
      { id: 'c', label: 'Evitar desinfectar para no dejar olor' },
      { id: 'd', label: 'Pulverizar primero todas las superficies sin distinguir material' },
    ],
  },
  {
    id: 'q07',
    topic: 'Inodoros',
    prompt: '¿Qué práctica es correcta al limpiar inodoros?',
    correctOptionId: 'd',
    explanation: 'El inodoro es una zona de baño donde sí corresponde producto de desinfección adecuado, con atención especial a contacto y acabado.',
    options: [
      { id: 'a', label: 'Usar el mismo paño que en espejos' },
      { id: 'b', label: 'Limpiar solo lo visible por fuera' },
      { id: 'c', label: 'Evitar secar para que el químico quede actuando' },
      { id: 'd', label: 'Desinfectar bien la pieza y repasar las zonas de contacto' },
    ],
  },
  {
    id: 'q08',
    topic: 'Lavabos y cerámica',
    prompt: '¿Qué debe revisarse al terminar lavabos y cerámica?',
    correctOptionId: 'a',
    explanation: 'No basta con limpiar: hay que dejar la superficie sin restos, marcas ni acumulación de producto.',
    options: [
      { id: 'a', label: 'Que no queden residuos, marcas ni exceso de producto' },
      { id: 'b', label: 'Que queden húmedos para seguir desinfectando' },
      { id: 'c', label: 'Que brillen aunque tengan restos de químico' },
      { id: 'd', label: 'Que el producto se seque solo sin repasar' },
    ],
  },
  {
    id: 'q09',
    topic: 'Duchas y griferías',
    prompt: 'Al limpiar duchas y griferías, ¿qué evita marcas y daños?',
    correctOptionId: 'b',
    explanation: 'El manual prioriza poca cantidad de producto y buen secado final, especialmente en superficies delicadas y brillantes.',
    options: [
      { id: 'a', label: 'Dejar el químico secando sobre la superficie' },
      { id: 'b', label: 'Usar poca cantidad y secar bien al final' },
      { id: 'c', label: 'Frotar con estropajo abrasivo' },
      { id: 'd', label: 'Aplicar lejía para evitar cal' },
    ],
  },
  {
    id: 'q10',
    topic: 'Mármol, granito y cuarzo',
    prompt: '¿Qué combinación está prohibida en mármol, granito y cuarzo?',
    correctOptionId: 'c',
    explanation: 'El manual prohíbe lejía, antical, desengrasante fuerte, ácidos y abrasivos sobre estas superficies.',
    options: [
      { id: 'a', label: 'Paño suave y producto neutro' },
      { id: 'b', label: 'Microfibra húmeda y secado final' },
      { id: 'c', label: 'Lejía, antical, ácidos o estropajos abrasivos' },
      { id: 'd', label: 'Poca agua y repaso suave' },
    ],
  },
  {
    id: 'q11',
    topic: 'Plásticos brillantes',
    prompt: '¿Qué debe hacerse con los plásticos brillantes?',
    correctOptionId: 'a',
    explanation: 'Son superficies sensibles al rayado y a residuos. Requieren producto suave y secado cuidado.',
    options: [
      { id: 'a', label: 'Limpiarlos con suavidad y secarlos para evitar marcas' },
      { id: 'b', label: 'Usar fibra verde para sacar brillo' },
      { id: 'c', label: 'Aplicar lejía para desinfectar mejor' },
      { id: 'd', label: 'Rociarlos directamente con desengrasante fuerte' },
    ],
  },
  {
    id: 'q12',
    topic: 'Máquinas de gimnasio',
    prompt: '¿Qué zona de las máquinas requiere especial atención en cada servicio?',
    correctOptionId: 'd',
    explanation: 'El manual destaca agarres y zonas de contacto porque concentran uso frecuente y deben quedar limpias sin dañar materiales.',
    options: [
      { id: 'a', label: 'Solo la base de la máquina' },
      { id: 'b', label: 'Solo la pantalla' },
      { id: 'c', label: 'Únicamente la parte trasera' },
      { id: 'd', label: 'Agarres, asientos y zonas de contacto' },
    ],
  },
  {
    id: 'q13',
    topic: 'Asientos',
    prompt: '¿Qué error debe evitarse al limpiar asientos de máquinas?',
    correctOptionId: 'b',
    explanation: 'Empapar los asientos deja residuos, tarda en secar y puede deteriorar el material. Debe usarse poca cantidad.',
    options: [
      { id: 'a', label: 'Repasar con paño limpio' },
      { id: 'b', label: 'Empaparlos de producto' },
      { id: 'c', label: 'Verificar que queden sin restos' },
      { id: 'd', label: 'Secarlos si el material lo necesita' },
    ],
  },
  {
    id: 'q14',
    topic: 'Cristales y espejos',
    prompt: '¿Qué resultado final debe quedar en cristales y espejos?',
    correctOptionId: 'c',
    explanation: 'La meta es una terminación limpia y seca, sin velos ni marcas visibles.',
    options: [
      { id: 'a', label: 'Con algo de humedad para que siga actuando' },
      { id: 'b', label: 'Con olor fuerte a químico' },
      { id: 'c', label: 'Sin marcas, sin velos y bien repasados' },
      { id: 'd', label: 'Con espuma fina mientras seca' },
    ],
  },
  {
    id: 'q15',
    topic: 'Acero inoxidable',
    prompt: '¿Cuál es una regla segura para acero inoxidable según el manual?',
    correctOptionId: 'a',
    explanation: 'No debe usarse lejía sobre acero inoxidable. Se limpia con método suave y secado correcto.',
    options: [
      { id: 'a', label: 'No usar lejía y secar bien la superficie' },
      { id: 'b', label: 'Aplicar antical fuerte cada vez' },
      { id: 'c', label: 'Frotar con abrasivo para sacar huellas' },
      { id: 'd', label: 'Rociar directamente con cualquier químico' },
    ],
  },
  {
    id: 'q16',
    topic: 'Suelos de gimnasio',
    prompt: 'En suelos de gimnasio, ¿qué refleja mejor el manual?',
    correctOptionId: 'd',
    explanation: 'Debe respetarse el material del suelo, sin exceder producto y evitando dejar residuos o exceso de agua.',
    options: [
      { id: 'a', label: 'Dejar bastante agua para aflojar la suciedad' },
      { id: 'b', label: 'Usar lejía siempre que haya pisadas' },
      { id: 'c', label: 'Aplicar el químico más fuerte disponible' },
      { id: 'd', label: 'Limpiar con control, respetando el material y el secado' },
    ],
  },
  {
    id: 'q17',
    topic: 'Madera o laminados',
    prompt: '¿Qué debe evitarse en madera o laminados?',
    correctOptionId: 'b',
    explanation: 'La madera y los laminados son sensibles. No se deben empapar ni tratar con productos agresivos como lejía.',
    options: [
      { id: 'a', label: 'Paño bien escurrido' },
      { id: 'b', label: 'Exceso de agua o lejía' },
      { id: 'c', label: 'Secado final' },
      { id: 'd', label: 'Revisión visual del acabado' },
    ],
  },
  {
    id: 'q18',
    topic: 'Checklist operativo',
    prompt: '¿Qué incluye el cierre correcto del servicio según el enfoque del manual?',
    correctOptionId: 'c',
    explanation: 'El cierre exige revisar resultado, corregir errores, dejar materiales en orden y confirmar que no queden restos ni daños.',
    options: [
      { id: 'a', label: 'Salir al terminar la última zona aunque falte revisar' },
      { id: 'b', label: 'Guardar materiales sin comprobar superficies' },
      { id: 'c', label: 'Revisar acabado, corregir fallos y dejar todo ordenado' },
      { id: 'd', label: 'Esperar a que el cliente avise si algo quedó mal' },
    ],
  },
  {
    id: 'q19',
    topic: 'Uso correcto de la aspiradora',
    prompt: 'Antes de usar la aspiradora, ¿qué pide revisar el manual?',
    correctOptionId: 'b',
    explanation: 'El manual indica verificar accesorio correcto y comprobar que filtro y depósito estén limpios antes de usarla.',
    options: [
      { id: 'a', label: 'Solo que el cable llegue a todas las zonas' },
      { id: 'b', label: 'Accesorio correcto, filtro limpio y depósito limpio' },
      { id: 'c', label: 'Que el depósito esté lleno para no parar' },
      { id: 'd', label: 'Que pueda aspirar líquidos aunque no esté permitido' },
    ],
  },
  {
    id: 'q20',
    topic: 'Errores frecuentes',
    prompt: '¿Cuál de estas acciones aparece como error frecuente en el manual?',
    correctOptionId: 'c',
    explanation: 'El manual destaca como error frecuente usar antical en piedra natural, además de usar lejía fuera del baño o limpiar pantallas con productos.',
    options: [
      { id: 'a', label: 'Secar griferías al terminar' },
      { id: 'b', label: 'Usar paño seco final en superficies delicadas' },
      { id: 'c', label: 'Usar antical en piedra natural' },
      { id: 'd', label: 'Separar microfibras usadas de las limpias' },
    ],
  },
]
