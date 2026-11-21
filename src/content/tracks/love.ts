import type { Track } from '../types.ts'

// Любов: romantic and sweet things to say to his wife.
// Addressing her uses feminine forms (красива, права, скъпа).
// Where the SPEAKER's gender changes the Bulgarian, `f` holds the woman's form.

export const love: Track = {
  id: 'love',
  title: 'Love',
  titleBg: 'Любов',
  tagline: 'Sweet and romantic things to say to her.',
  emoji: '❤️',
  items: [
    // ---------------------------------------------------------- Unit 1: Sweet words
    // L1 Words of love
    { id: 'love.lyubov', kind: 'word', bg: 'любов', tr: 'lyubóv', en: 'love', emoji: '❤️' },
    {
      id: 'love.skapa', kind: 'word', bg: 'скъпа', tr: 'skắpa', en: 'darling', emoji: '💕',
      alt: ['dear', 'honey', 'sweetheart'],
      note: 'Literally "dear" (it also means "expensive"). Said to a woman; to a man it is скъпи.',
    },
    {
      id: 'love.mila', kind: 'word', bg: 'мила', tr: 'míla', en: 'dear', emoji: '🥰',
      alt: ['sweet', 'sweetheart', 'kind'],
      note: 'Also means "kind" or "sweet". Мила моя = my dear.',
    },
    {
      id: 'love.sartse', kind: 'word', bg: 'сърце', tr: 'sărtsé', en: 'heart', emoji: '💗',
      note: 'Bulgarians call the people they love сърце all the time.',
    },
    { id: 'love.tseluvka', kind: 'word', bg: 'целувка', tr: 'tselúvka', en: 'kiss', emoji: '💋' },

    // L2 Pet names
    {
      id: 'love.slanchitse', kind: 'word', bg: 'слънчице', tr: 'slắnchitse', en: 'sunshine', emoji: '☀️',
      alt: ['little sun'],
      note: 'A little form of слънце (sun). The -ице ending makes a word cuddly.',
    },
    {
      id: 'love.zaiche', kind: 'word', bg: 'зайче', tr: 'záyche', en: 'bunny', emoji: '🐰',
      alt: ['little bunny', 'little rabbit'],
      note: 'Animal pet names are very common between Bulgarian couples.',
    },
    {
      id: 'love.sakrovishte', kind: 'word', bg: 'съкровище', tr: 'săkróvishte', en: 'treasure', emoji: '💎',
      alt: ['my treasure'],
    },
    {
      id: 'love.krasavitse', kind: 'word', bg: 'красавице', tr: 'krasávitse', en: 'gorgeous', emoji: '🌹',
      alt: ['beauty', 'my beauty', 'beautiful'],
      note: 'The calling form of красавица (a beauty), used when you speak to her directly.',
    },
    {
      id: 'love.milichka', kind: 'word', bg: 'миличка', tr: 'mílichka', en: 'sweetie', emoji: '🍬',
      alt: ['sweetheart', 'honey', 'darling', 'dear'],
    },

    // L3 I love you
    {
      id: 'love.obicham-te', kind: 'phrase', bg: 'Обичам те.', tr: 'obícham te', en: 'I love you.', emoji: '😍',
      alt: ['love you'],
      note: 'те means "you" here. It is a small word that leans on the verb.',
    },
    {
      id: 'love.lyubov-moya', kind: 'phrase', bg: 'любов моя', tr: 'lyubóv móya', en: 'my love', emoji: '💞',
      bgAlt: ['Моя любов'],
      note: 'Putting моя after the noun sounds tender and a little poetic.',
    },
    {
      id: 'love.sartse-moe', kind: 'phrase', bg: 'сърце мое', tr: 'sărtsé móe', en: 'my heart', emoji: '💓',
      alt: ['sweetheart'],
      bgAlt: ['Мое сърце'],
    },
    {
      id: 'love.obicham-te-skapa', kind: 'phrase', bg: 'Обичам те, скъпа.', tr: 'obícham te, skắpa', en: 'I love you, darling.', emoji: '💕',
      alt: ['i love you honey', 'i love you dear', 'i love you sweetheart', 'love you darling'],
    },
    {
      id: 'love.ti-si-moyata-lyubov', kind: 'phrase', bg: 'Ти си моята любов.', tr: 'ti si móyata lyubóv', en: 'You are my love.', emoji: '💑',
      alt: ['youre my love'],
    },

    // ---------------------------------------------------------- Unit 2: Compliments
    // L1 Beautiful and smart
    {
      id: 'love.krasiva', kind: 'word', bg: 'красива', tr: 'krasíva', en: 'beautiful', emoji: '🌸',
      note: 'Ends in -а because it describes a woman. About a man: красив.',
    },
    {
      id: 'love.hubava', kind: 'word', bg: 'хубава', tr: 'húbava', en: 'pretty', emoji: '🌷',
      alt: ['lovely', 'nice', 'good-looking'],
    },
    {
      id: 'love.umna', kind: 'word', bg: 'умна', tr: 'úmna', en: 'smart', emoji: '🧠',
      alt: ['clever', 'intelligent'],
      note: 'From ум (mind). About a man: умен.',
    },
    {
      id: 'love.prekrasna', kind: 'word', bg: 'прекрасна', tr: 'prekrásna', en: 'wonderful', emoji: '✨',
      alt: ['lovely', 'marvellous', 'marvelous', 'gorgeous'],
    },
    {
      id: 'love.mnogo', kind: 'word', bg: 'много', tr: 'mnógo', en: 'very', emoji: '💯',
      alt: ['a lot', 'much', 'many', 'so'],
    },

    // L2 Eyes, hair, smile
    {
      id: 'love.ochi', kind: 'word', bg: 'очи', tr: 'ochí', en: 'eyes', emoji: '👀',
      note: 'Plural of око (eye), which is irregular.',
    },
    { id: 'love.kosa', kind: 'word', bg: 'коса', tr: 'kosá', en: 'hair', emoji: '💇‍♀️' },
    { id: 'love.usmivka', kind: 'word', bg: 'усмивка', tr: 'usmívka', en: 'smile', emoji: '😊' },
    { id: 'love.roklya', kind: 'word', bg: 'рокля', tr: 'róklya', en: 'dress', emoji: '👗' },
    { id: 'love.ustni', kind: 'word', bg: 'устни', tr: 'ustní', en: 'lips', emoji: '💋', alt: ['your lips', 'mouth'] },

    // L3 You're beautiful
    {
      id: 'love.krasiva-si', kind: 'phrase', bg: 'Красива си.', tr: 'krasíva si', en: "You're beautiful.", emoji: '😍',
      alt: ['you are beautiful'],
      bgAlt: ['Ти си красива'],
    },
    {
      id: 'love.mnogo-si-krasiva-dnes', kind: 'phrase', bg: 'Много си красива днес.', tr: 'mnógo si krasíva dnes', en: 'You look very beautiful today.', emoji: '🌹',
      alt: ['you are very beautiful today', 'youre very beautiful today', 'you look beautiful today', 'you are so beautiful today', 'youre so beautiful today'],
      bgAlt: ['Днес си много красива'],
    },
    {
      id: 'love.obicham-usmivkata-ti', kind: 'phrase', bg: 'Обичам усмивката ти.', tr: 'obícham usmívkata ti', en: 'I love your smile.', emoji: '😊',
      note: '-та on the end means "the": усмивка → усмивката. ти after it means "your".',
    },
    {
      id: 'love.imash-krasivi-ochi', kind: 'phrase', bg: 'Имаш красиви очи.', tr: 'ímash krasívi ochí', en: 'You have beautiful eyes.', emoji: '👀',
    },
    {
      id: 'love.roklyata-ti-e-prekrasna', kind: 'phrase', bg: 'Роклята ти е прекрасна.', tr: 'róklyata ti e prekrásna', en: 'Your dress is gorgeous.', emoji: '👗',
      alt: ['your dress is wonderful', 'your dress is beautiful', 'your dress is lovely'],
    },
    {
      id: 'love.mnogo-te-obicham', kind: 'phrase', bg: 'Много те обичам.', tr: 'mnógo te obícham', en: 'I love you so much.', emoji: '🥰',
      alt: ['i love you very much', 'i love you a lot'],
      note: 'те can never start a sentence, so it moves in front of обичам when another word comes first.',
    },

    // ---------------------------------------------------------- Unit 3: Morning and night
    // L1 From morning to night
    { id: 'love.utro', kind: 'word', bg: 'утро', tr: 'útro', en: 'morning', emoji: '🌅' },
    { id: 'love.nosht', kind: 'word', bg: 'нощ', tr: 'nosht', en: 'night', emoji: '🌙' },
    { id: 'love.sanishta', kind: 'word', bg: 'сънища', tr: 'sắnishta', en: 'dreams', emoji: '💭' },
    {
      id: 'love.pregradka', kind: 'word', bg: 'прегръдка', tr: 'pregrắdka', en: 'hug', emoji: '🤗',
      alt: ['cuddle', 'embrace'],
    },
    { id: 'love.budilnik', kind: 'word', bg: 'будилник', tr: 'budílnik', en: 'alarm clock', emoji: '⏰', alt: ['alarm', 'the alarm', 'an alarm clock'] },

    // L2 Sweet texts
    {
      id: 'love.mislya', kind: 'word', bg: 'мисля', tr: 'míslya', en: 'I think', emoji: '🤔',
      alt: ['i am thinking', 'im thinking'],
    },
    {
      id: 'love.za-teb', kind: 'phrase', bg: 'за теб', tr: 'za teb', en: 'for you', emoji: '🎁',
      alt: ['about you', 'of you'],
    },
    { id: 'love.skoro', kind: 'word', bg: 'скоро', tr: 'skóro', en: 'soon', emoji: '⏳' },
    {
      id: 'love.vkashti', kind: 'word', bg: 'вкъщи', tr: 'vkắshti', en: 'at home', emoji: '🏠',
      alt: ['home'],
      note: 'The в sounds like "f" here, because it sits next to к: "fkăshti".',
    },
    {
      id: 'love.tseluvki', kind: 'word', bg: 'целувки', tr: 'tselúvki', en: 'kisses', emoji: '😘',
      note: 'Plural of целувка. The classic way to sign off a text to her.',
    },

    // L3 Sweet dreams
    {
      id: 'love.dobro-utro-skapa', kind: 'phrase', bg: 'Добро утро, скъпа.', tr: 'dobró útro, skắpa', en: 'Good morning, darling.', emoji: '🌞',
      alt: ['good morning honey', 'good morning dear', 'good morning sweetheart'],
    },
    {
      id: 'love.leka-nosht-lyubov-moya', kind: 'phrase', bg: 'Лека нощ, любов моя.', tr: 'léka nosht, lyubóv móya', en: 'Good night, my love.', emoji: '🌙',
      alt: ['goodnight my love', 'good night love'],
    },
    { id: 'love.sanuvay-me', kind: 'phrase', bg: 'Сънувай ме.', tr: 'sănúvay me', en: 'Dream of me.', emoji: '💭', alt: ['dream of me', 'dream about me'], note: 'A sweet last text of the night.' },
    {
      id: 'love.mislya-za-teb', kind: 'phrase', bg: 'Мисля за теб.', tr: 'míslya za teb', en: "I'm thinking of you.", emoji: '💭',
      alt: ['i am thinking of you', 'i am thinking about you', 'im thinking about you', 'i think of you', 'thinking of you', 'i think about you'],
    },
    {
      id: 'love.lipsvash-mi', kind: 'phrase', bg: 'Липсваш ми.', tr: 'lípsvash mi', en: 'I miss you.', emoji: '🥺',
      alt: ['miss you'],
      note: 'Literally "you are missing to me". She is the subject, you are the one who feels it.',
    },
    {
      id: 'love.skoro-shte-sam-vkashti', kind: 'phrase', bg: 'Скоро ще съм вкъщи.', tr: 'skóro shte săm vkắshti', en: "I'll be home soon.", emoji: '🏠',
      alt: ['i will be home soon', 'ill be home soon'],
      bgAlt: ['Скоро ще бъда вкъщи', 'Скоро се прибирам'],
      note: 'ще makes the future: ще съм = I will be.',
    },

    // ---------------------------------------------------------- Unit 4: Date night
    // L1 Feelings
    {
      id: 'love.shtastliv', kind: 'word', bg: 'щастлив', tr: 'shtastlív', en: 'happy', emoji: '😄',
      f: { bg: 'щастлива', tr: 'shtastlíva' },
      note: 'Words that describe you change with your gender: a man is щастлив, a woman щастлива.',
    },
    {
      id: 'love.vlyuben', kind: 'word', bg: 'влюбен', tr: 'vlyúben', en: 'in love', emoji: '😍',
      f: { bg: 'влюбена', tr: 'vlyúbena' },
      note: 'Влюбен съм в теб = I am in love with you.',
    },
    { id: 'love.zaedno', kind: 'word', bg: 'заедно', tr: 'záedno', en: 'together', emoji: '👫' },
    { id: 'love.zavinagi', kind: 'word', bg: 'завинаги', tr: 'zavínagi', en: 'forever', emoji: '♾️' },
    {
      id: 'love.sazhalyavam', kind: 'word', bg: 'съжалявам', tr: 'săzhalyávam', en: "I'm sorry", emoji: '🙏',
      alt: ['sorry', 'i am sorry', 'im sorry'],
      note: 'A real apology. For small slips, извинявай works too.',
    },

    // L2 Going out
    { id: 'love.restorant', kind: 'word', bg: 'ресторант', tr: 'restoránt', en: 'restaurant', emoji: '🍽️', alt: ['a restaurant', 'the restaurant'] },
    {
      id: 'love.sreshta', kind: 'word', bg: 'среща', tr: 'sréshta', en: 'date', emoji: '🕯️',
      alt: ['meeting'],
      note: 'Any meeting; a romantic date is also среща.',
    },
    { id: 'love.vino', kind: 'word', bg: 'вино', tr: 'víno', en: 'wine', emoji: '🍷' },
    {
      id: 'love.tantsuvame', kind: 'word', bg: 'танцуваме', tr: 'tantsúvame', en: 'we dance', emoji: '💃',
      alt: ['we are dancing'],
    },
    {
      id: 'love.zhena', kind: 'word', bg: 'жена', tr: 'zhená', en: 'wife', emoji: '👰',
      alt: ['woman'],
      note: 'Means both "woman" and "wife". Моята жена = my wife.',
    },

    // L3 Let's dance
    {
      id: 'love.shtastliv-sam-s-teb', kind: 'phrase', bg: 'Щастлив съм с теб.', tr: 'shtastlív săm s teb', en: "I'm happy with you.", emoji: '😊',
      alt: ['i am happy with you', 'im happy with you'],
      f: { bg: 'Щастлива съм с теб.', tr: 'shtastlíva săm s teb' },
    },
    {
      id: 'love.da-izlezem-li-na-vecherya', kind: 'phrase', bg: 'Да излезем ли на вечеря?', tr: 'da izlézem li na vechérya', en: 'Shall we go out for dinner?', emoji: '🍽️',
      alt: ['shall we go out to dinner', 'should we go out for dinner', 'lets go out for dinner', 'do you want to go out for dinner'],
      bgAlt: ['Искаш ли да излезем на вечеря?'],
      note: 'Да излезем = let us go out; ли turns it into a question.',
    },
    {
      id: 'love.iskash-li-da-tantsuvame', kind: 'phrase', bg: 'Искаш ли да танцуваме?', tr: 'ískash li da tantsúvame', en: 'Do you want to dance?', emoji: '💃',
      alt: ['shall we dance', 'would you like to dance', 'do you want to dance with me'],
    },
    {
      id: 'love.zaedno-zavinagi', kind: 'phrase', bg: 'Заедно завинаги!', tr: 'záedno zavínagi', en: 'Together forever!', emoji: '♾️',
      alt: ['forever together'],
    },
    {
      id: 'love.ti-si-prava', kind: 'phrase', bg: 'Ти си права.', tr: 'ti si práva', en: "You're right.", emoji: '😅',
      alt: ['you are right'],
      bgAlt: ['Права си'],
      note: 'права is the feminine form. Possibly the most useful sentence a husband can learn.',
    },
    {
      id: 'love.sazhalyavam-skapa', kind: 'phrase', bg: 'Съжалявам, скъпа.', tr: 'săzhalyávam, skắpa', en: "I'm sorry, darling.", emoji: '💐',
      alt: ['sorry darling', 'im sorry honey', 'i am sorry darling', 'sorry honey', 'im sorry dear', 'i am sorry honey'],
    },

    // ---------------------------------------------------------- Unit 5: Plans and surprises
    // L1 Surprises
    { id: 'love.iznenada', kind: 'word', bg: 'изненада', tr: 'iznenáda', en: 'surprise', emoji: '🎉' },
    { id: 'love.prasten', kind: 'word', bg: 'пръстен', tr: 'prắsten', en: 'ring', emoji: '💍', alt: ['a ring', 'the ring'] },
    {
      id: 'love.tsvetya', kind: 'word', bg: 'цветя', tr: 'tsvetyá', en: 'flowers', emoji: '💐',
      note: 'Bring an odd number of flowers. Even numbers are for funerals in Bulgaria.',
    },
    { id: 'love.uikend', kind: 'word', bg: 'уикенд', tr: 'uikénd', en: 'weekend', emoji: '🗓️' },
    { id: 'love.patuvane', kind: 'word', bg: 'пътуване', tr: 'pătúvane', en: 'trip', emoji: '✈️', alt: ['journey', 'a trip', 'travel', 'travelling'] },

    // L2 Going places
    { id: 'love.bileti', kind: 'word', bg: 'билети', tr: 'biléti', en: 'tickets', emoji: '🎟️' },
    {
      id: 'love.kino', kind: 'word', bg: 'кино', tr: 'kíno', en: 'cinema', emoji: '🎬',
      alt: ['movies', 'the movies', 'the cinema', 'movie theater', 'movie theatre'],
    },
    { id: 'love.teatar', kind: 'word', bg: 'театър', tr: 'teátăr', en: 'theatre', emoji: '🎭', alt: ['theater', 'the theatre', 'the theater', 'a play'] },
    { id: 'love.kontsert', kind: 'word', bg: 'концерт', tr: 'kontsért', en: 'concert', emoji: '🎵', alt: ['a concert', 'the concert', 'gig'] },
    {
      id: 'love.dovechera', kind: 'word', bg: 'довечера', tr: 'dovéchera', en: 'tonight', emoji: '🌆',
      alt: ['this evening', 'later tonight'],
      note: 'Later this evening, when it is still day now.',
    },

    // L3 Let's go away
    {
      id: 'love.imam-iznenada-za-teb', kind: 'phrase', bg: 'Имам изненада за теб.', tr: 'ímam iznenáda za teb', en: 'I have a surprise for you.', emoji: '🎁',
      alt: ['ive got a surprise for you', 'i have got a surprise for you'],
    },
    {
      id: 'love.tova-e-podarak-za-teb', kind: 'phrase', bg: 'Това е подарък за теб.', tr: 'tová e podárăk za teb', en: 'This is a present for you.', emoji: '💝',
      alt: ['this is a gift for you', 'this present is for you'],
    },
    {
      id: 'love.kakvo-shte-pravim-uikenda', kind: 'phrase', bg: 'Какво ще правим този уикенд?', tr: 'kakvó shte právim tózi uikénd', en: 'What shall we do this weekend?', emoji: '🗓️',
      alt: ['what are we doing this weekend', 'what will we do this weekend', 'what should we do this weekend'],
      note: 'ще + verb is the future: ще правим = we will do.',
    },
    {
      id: 'love.da-otidem-na-kino', kind: 'phrase', bg: 'Да отидем на кино довечера?', tr: 'da otídem na kíno dovéchera', en: 'Shall we go to the cinema tonight?', emoji: '🍿',
      alt: ['shall we go to the movies tonight', 'should we go to the cinema tonight', 'lets go to the cinema tonight', 'lets go to the movies tonight'],
      bgAlt: ['Да отидем ли на кино довечера?'],
    },
    {
      id: 'love.rezervirah-masa', kind: 'phrase', bg: 'Резервирах маса за двама.', tr: 'rezervírah mása za dváma', en: 'I booked a table for two.', emoji: '🍽️',
      alt: ['i reserved a table for two', 'ive booked a table for two', 'i have booked a table for two'],
      note: 'The -х ending means "I did it": резервирах = I booked.',
    },
    {
      id: 'love.tova-lyato-na-more', kind: 'phrase', bg: 'Това лято ще отидем на море.', tr: 'tová lyáto shte otídem na moré', en: "This summer we'll go to the seaside.", emoji: '🏖️',
      alt: ['this summer we will go to the seaside', 'we will go to the seaside this summer', 'well go to the seaside this summer', 'this summer we will go to the sea', 'this summer well go to the sea'],
    },

    // ---------------------------------------------------------- Unit 6: Making up
    // L1 After a fight
    {
      id: 'love.kavga', kind: 'word', bg: 'кавга', tr: 'kavgá', en: 'argument', emoji: '💢',
      alt: ['quarrel', 'fight', 'row'],
    },
    { id: 'love.proshka', kind: 'word', bg: 'прошка', tr: 'próshka', en: 'forgiveness', emoji: '🕊️' },
    {
      id: 'love.vina', kind: 'word', bg: 'вина', tr: 'viná', en: 'fault', emoji: '🙇',
      alt: ['guilt', 'blame'],
    },
    { id: 'love.tarpenie', kind: 'word', bg: 'търпение', tr: 'tărpénie', en: 'patience', emoji: '🧘', alt: ['be patient'], note: 'Имай търпение с мен: be patient with me.' },
    {
      id: 'love.slusham', kind: 'word', bg: 'слушам', tr: 'slúsham', en: "I'm listening", emoji: '👂',
      alt: ['i am listening', 'i listen'],
    },

    // L2 I'm here for you
    { id: 'love.vinagi', kind: 'word', bg: 'винаги', tr: 'vínagi', en: 'always', emoji: '🔁' },
    {
      id: 'love.do-teb', kind: 'phrase', bg: 'до теб', tr: 'do teb', en: 'by your side', emoji: '🫂',
      alt: ['next to you', 'beside you', 'with you'],
    },
    { id: 'love.pomosht', kind: 'word', bg: 'помощ', tr: 'pómosht', en: 'help', emoji: '🤲' },
    { id: 'love.silna', kind: 'word', bg: 'силна', tr: 'sílna', en: 'strong', emoji: '💪', alt: ['you are strong'], note: 'Ти си много силна: you are very strong.' },
    {
      id: 'love.tazhna', kind: 'word', bg: 'тъжна', tr: 'tắzhna', en: 'sad', emoji: '😢',
      note: 'The feminine form. About a man: тъжен.',
    },

    // L3 Forgive me
    {
      id: 'love.prosti-mi', kind: 'phrase', bg: 'Прости ми.', tr: 'prostí mi', en: 'Forgive me.', emoji: '😔',
      alt: ['please forgive me'],
    },
    {
      id: 'love.vinata-e-moya', kind: 'phrase', bg: 'Вината е моя.', tr: 'vináta e móya', en: "It's my fault.", emoji: '😞',
      alt: ['it is my fault', 'my fault', 'the fault is mine'],
      bgAlt: ['Моя е вината'],
    },
    {
      id: 'love.da-ne-se-karame', kind: 'phrase', bg: 'Да не се караме.', tr: 'da ne se kárame', en: "Let's not fight.", emoji: '🕊️',
      alt: ['let us not fight', 'lets not argue', 'let us not argue', 'lets not quarrel'],
      note: 'Карам се = to quarrel. Да не + verb is a gentle "let\'s not".',
    },
    {
      id: 'love.slusham-te', kind: 'phrase', bg: 'Слушам те.', tr: 'slúsham te', en: "I'm listening to you.", emoji: '👂',
      alt: ['i am listening to you', 'im listening', 'i am listening', 'i hear you'],
    },
    {
      id: 'love.vinagi-sam-do-teb', kind: 'phrase', bg: 'Винаги съм до теб.', tr: 'vínagi săm do teb', en: "I'm always here for you.", emoji: '💪',
      alt: ['i am always here for you', 'i am always by your side', 'im always by your side', 'i am always with you', 'im always with you'],
    },
    {
      id: 'love.zashto-si-tazhna', kind: 'phrase', bg: 'Защо си тъжна?', tr: 'zashtó si tắzhna', en: 'Why are you sad?', emoji: '🌧️',
      alt: ['why are you so sad'],
    },

    // ---------------------------------------------------------- Unit 7: Our story
    // L1 Our family
    {
      id: 'love.spomen', kind: 'word', bg: 'спомен', tr: 'spómen', en: 'memory', emoji: '📷',
      alt: ['a memory', 'keepsake'],
    },
    { id: 'love.svatba', kind: 'word', bg: 'сватба', tr: 'svátba', en: 'wedding', emoji: '💒' },
    { id: 'love.semeystvo', kind: 'word', bg: 'семейство', tr: 'seméystvo', en: 'family', emoji: '👨‍👩‍👧‍👦' },
    { id: 'love.badeshte', kind: 'word', bg: 'бъдеще', tr: 'bắdeshte', en: 'future', emoji: '🔮' },
    { id: 'love.dom', kind: 'word', bg: 'дом', tr: 'dom', en: 'home', emoji: '🏡', alt: ['house', 'our home'] },

    // L2 Thank you
    {
      id: 'love.gord', kind: 'word', bg: 'горд', tr: 'gord', en: 'proud', emoji: '🏆',
      f: { bg: 'горда', tr: 'górda' },
      note: 'A man is горд, a woman горда.',
    },
    {
      id: 'love.blagodaren', kind: 'word', bg: 'благодарен', tr: 'blagodáren', en: 'grateful', emoji: '🌻',
      alt: ['thankful'],
      f: { bg: 'благодарна', tr: 'blagodárna' },
    },
    {
      id: 'love.za-parvi-pat', kind: 'phrase', bg: 'за първи път', tr: 'za pắrvi păt', en: 'for the first time', emoji: '🌟',
      alt: ['the first time'],
    },
    {
      id: 'love.vsichko', kind: 'word', bg: 'всичко', tr: 'vsíchko', en: 'everything', emoji: '🌍',
      alt: ['all'],
    },
    { id: 'love.godini', kind: 'word', bg: 'години', tr: 'godíni', en: 'years', emoji: '📆' },

    // L3 Our story
    {
      id: 'love.pomnish-li-kak-se-zapoznahme', kind: 'phrase', bg: 'Помниш ли как се запознахме?', tr: 'pómnish li kak se zapoznáhme', en: 'Do you remember how we met?', emoji: '💫',
      alt: ['remember how we met', 'do you remember how we first met'],
    },
    {
      id: 'love.gord-sam-s-teb', kind: 'phrase', bg: 'Горд съм с теб.', tr: 'gord săm s teb', en: "I'm proud of you.", emoji: '🏅',
      alt: ['i am proud of you'],
      bgAlt: ['Гордея се с теб'],
      f: { bg: 'Горда съм с теб.', tr: 'górda săm s teb' },
    },
    {
      id: 'love.blagodarya-ti-za-vsichko', kind: 'phrase', bg: 'Благодаря ти за всичко.', tr: 'blagodaryá ti za vsíchko', en: 'Thank you for everything.', emoji: '💖',
      alt: ['thanks for everything'],
    },
    {
      id: 'love.nay-hubavoto-neshto', kind: 'phrase', bg: 'Ти си най-хубавото нещо в живота ми.', tr: 'ti si nay-húbavoto néshto v zhivóta mi', en: "You're the best thing in my life.", emoji: '👑',
      alt: ['you are the best thing in my life', 'youre the best thing that ever happened to me'],
      note: 'най- in front of an adjective makes "the most": най-хубаво = the best, the most beautiful.',
    },
    {
      id: 'love.iskam-da-ostareya-s-teb', kind: 'phrase', bg: 'Искам да остарея с теб.', tr: 'ískam da ostaréya s teb', en: 'I want to grow old with you.', emoji: '🧓',
      alt: ['i want to grow old together with you', 'i want to get old with you'],
    },
    {
      id: 'love.nay-dobrata-mayka', kind: 'phrase', bg: 'Ти си най-добрата майка.', tr: 'ti si nay-dobráta máyka', en: "You're the best mother.", emoji: '👩‍👧',
      alt: ['you are the best mother', 'youre the best mom', 'you are the best mom', 'youre the best mum', 'you are the best mum'],
    },
  ],
  units: [
    {
      id: 'love.u1',
      canDo: 'You can tell her you love her and call her by a sweet pet name',
      title: 'Sweet words',
      titleBg: 'Мили думи',
      description: 'Pet names and the first words of love.',
      emoji: '💕',
      lessons: [
        { id: 'love.u1.l1', title: 'Words of love', titleBg: 'Думи за любов', items: ['love.lyubov', 'love.skapa', 'love.mila', 'love.sartse', 'love.tseluvka'] },
        { id: 'love.u1.l2', title: 'Pet names', titleBg: 'Галени имена', items: ['love.slanchitse', 'love.zaiche', 'love.sakrovishte', 'love.krasavitse', 'love.milichka'] },
        { id: 'love.u1.l3', title: 'I love you', titleBg: 'Обичам те', items: ['love.obicham-te', 'love.lyubov-moya', 'love.sartse-moe', 'love.obicham-te-skapa', 'love.ti-si-moyata-lyubov'] },
      ],
    },
    {
      id: 'love.u2',
      canDo: 'You can tell her she is beautiful and compliment her eyes and smile',
      title: 'Compliments',
      titleBg: 'Комплименти',
      description: 'Tell her how beautiful she is.',
      emoji: '🌹',
      lessons: [
        { id: 'love.u2.l1', title: 'Beautiful and smart', titleBg: 'Красива и умна', items: ['love.krasiva', 'love.hubava', 'love.umna', 'love.prekrasna', 'love.mnogo'] },
        { id: 'love.u2.l2', title: 'Eyes, hair, smile', titleBg: 'Очи, коса, усмивка', items: ['love.ochi', 'love.kosa', 'love.usmivka', 'love.roklya', 'love.ustni'] },
        { id: 'love.u2.l3', title: "You're beautiful", titleBg: 'Красива си', items: ['love.krasiva-si', 'love.mnogo-si-krasiva-dnes', 'love.obicham-usmivkata-ti', 'love.imash-krasivi-ochi', 'love.roklyata-ti-e-prekrasna', 'love.mnogo-te-obicham'] },
      ],
    },
    {
      id: 'love.u3',
      canDo: 'You can say good morning and good night to her and send a sweet text',
      title: 'Morning and night',
      titleBg: 'Сутрин и вечер',
      description: 'Good morning, good night and sweet texts.',
      emoji: '🌙',
      lessons: [
        { id: 'love.u3.l1', title: 'Morning to night', titleBg: 'От утро до нощ', items: ['love.utro', 'love.nosht', 'love.sanishta', 'love.pregradka', 'love.budilnik'] },
        { id: 'love.u3.l2', title: 'Sweet texts', titleBg: 'Мили съобщения', items: ['love.mislya', 'love.za-teb', 'love.skoro', 'love.vkashti', 'love.tseluvki'] },
        { id: 'love.u3.l3', title: 'Sweet dreams', titleBg: 'Сладки сънища', items: ['love.dobro-utro-skapa', 'love.leka-nosht-lyubov-moya', 'love.sanuvay-me', 'love.mislya-za-teb', 'love.lipsvash-mi', 'love.skoro-shte-sam-vkashti'] },
      ],
    },
    {
      id: 'love.u4',
      canDo: 'You can ask her out to dinner and tell her how you feel',
      title: 'Date night',
      titleBg: 'Вечер за двама',
      description: 'Feelings, dinner dates and making up.',
      emoji: '🍷',
      lessons: [
        { id: 'love.u4.l1', title: 'Feelings', titleBg: 'Чувства', items: ['love.shtastliv', 'love.vlyuben', 'love.zaedno', 'love.zavinagi', 'love.sazhalyavam'] },
        { id: 'love.u4.l2', title: 'Going out', titleBg: 'Излизане', items: ['love.restorant', 'love.sreshta', 'love.vino', 'love.tantsuvame', 'love.zhena'] },
        { id: 'love.u4.l3', title: "Let's dance", titleBg: 'Да танцуваме', items: ['love.shtastliv-sam-s-teb', 'love.da-izlezem-li-na-vecherya', 'love.iskash-li-da-tantsuvame', 'love.zaedno-zavinagi', 'love.ti-si-prava', 'love.sazhalyavam-skapa'] },
      ],
    },
    {
      id: 'love.u5',
      canDo: 'You can plan a surprise and suggest a trip away together',
      title: 'Plans and surprises',
      titleBg: 'Планове и изненади',
      description: 'Make plans together and surprise her.',
      emoji: '🎁',
      lessons: [
        { id: 'love.u5.l1', title: 'Surprises', titleBg: 'Изненади', items: ['love.iznenada', 'love.prasten', 'love.tsvetya', 'love.uikend', 'love.patuvane'] },
        { id: 'love.u5.l2', title: 'Going places', titleBg: 'Накъде?', items: ['love.bileti', 'love.kino', 'love.teatar', 'love.kontsert', 'love.dovechera'] },
        { id: 'love.u5.l3', title: "Let's go away", titleBg: 'Да заминем', items: ['love.imam-iznenada-za-teb', 'love.tova-e-podarak-za-teb', 'love.kakvo-shte-pravim-uikenda', 'love.da-otidem-na-kino', 'love.rezervirah-masa', 'love.tova-lyato-na-more'] },
      ],
    },
    {
      id: 'love.u6',
      canDo: 'You can say sorry, really listen and tell her you are there for her',
      title: 'Making up',
      titleBg: 'Сдобряване',
      description: 'Say sorry, listen and be there for her.',
      emoji: '🕊️',
      lessons: [
        { id: 'love.u6.l1', title: 'After a fight', titleBg: 'След кавга', items: ['love.kavga', 'love.proshka', 'love.vina', 'love.tarpenie', 'love.slusham'] },
        { id: 'love.u6.l2', title: "I'm here for you", titleBg: 'Тук съм', items: ['love.vinagi', 'love.do-teb', 'love.pomosht', 'love.silna', 'love.tazhna'] },
        { id: 'love.u6.l3', title: 'Forgive me', titleBg: 'Прости ми', items: ['love.prosti-mi', 'love.vinata-e-moya', 'love.da-ne-se-karame', 'love.slusham-te', 'love.vinagi-sam-do-teb', 'love.zashto-si-tazhna'] },
      ],
    },
    {
      id: 'love.u7',
      canDo: 'You can tell your story: how you met and the life you are building',
      title: 'Our story',
      titleBg: 'Нашата история',
      description: 'How you met, your family and the years ahead.',
      emoji: '💍',
      lessons: [
        { id: 'love.u7.l1', title: 'Our family', titleBg: 'Нашето семейство', items: ['love.spomen', 'love.svatba', 'love.semeystvo', 'love.badeshte', 'love.dom'] },
        { id: 'love.u7.l2', title: 'Thank you', titleBg: 'Благодаря ти', items: ['love.gord', 'love.blagodaren', 'love.za-parvi-pat', 'love.vsichko', 'love.godini'] },
        { id: 'love.u7.l3', title: 'Our story', titleBg: 'Нашата история', items: ['love.pomnish-li-kak-se-zapoznahme', 'love.gord-sam-s-teb', 'love.blagodarya-ti-za-vsichko', 'love.nay-hubavoto-neshto', 'love.iskam-da-ostareya-s-teb', 'love.nay-dobrata-mayka'] },
      ],
    },
  ],
  dialogues: [
    {
      id: 'love.d1',
      unitId: 'love.u1',
      title: 'Before work',
      titleBg: 'Преди работа',
      scene: 'You are rushing out of the door in the morning. Your wife stops you.',
      emoji: '💋',
      lines: [
        { who: 'wife', bg: 'Чакай! Къде отиваш без целувка?', tr: 'chákay! kădé otívash bez tselúvka', en: 'Wait! Where are you going without a kiss?' },
        { who: 'me', bg: 'Целувка за моето съкровище!', tr: 'tselúvka za móeto săkróvishte', en: 'A kiss for my treasure!', wrong: ['Лека нощ, съкровище!', 'Не искам кафе, мила.'] },
        { who: 'wife', bg: 'Само една?', tr: 'sámo edná', en: 'Only one?' },
        { who: 'me', bg: 'Добре, още една. Обичам те, скъпа!', tr: 'dobré, óshte edná. obícham te, skắpa', en: 'OK, one more. I love you, darling!', wrong: ['Едно кафе, моля.', 'Лека нощ, зайче.'] },
        { who: 'wife', bg: 'И аз те обичам, зайче. Приятен ден!', tr: 'i az te obícham, záyche. priyáten den', en: 'I love you too, bunny. Have a nice day!' },
        { who: 'me', bg: 'Приятен ден, любов моя!', tr: 'priyáten den, lyubóv móya', en: 'Have a nice day, my love!', wrong: ['Добро утро, мамо!', 'Сладки сънища, любов моя!'] },
      ],
      questions: [
        { q: 'What does your wife want before you leave?', options: ['A coffee', 'A kiss', 'Her keys'], answer: 1 },
        { q: 'What does she call you?', options: ['Bunny', 'Treasure', 'Sunshine'], answer: 0 },
      ],
    },
    {
      id: 'love.d2',
      unitId: 'love.u2',
      title: 'Ready to go',
      titleBg: 'Готова ли си?',
      scene: 'Your wife comes out in a new dress before a family dinner.',
      emoji: '👗',
      lines: [
        { who: 'wife', bg: 'Как изглеждам?', tr: 'kak izglézhdam', en: 'How do I look?' },
        { who: 'me', bg: 'Много си красива днес!', tr: 'mnógo si krasíva dnes', en: 'You look very beautiful today!', wrong: ['Днес е много студено.', 'Имам много работа днес.'] },
        { who: 'wife', bg: 'Наистина ли? Роклята е нова.', tr: 'naístina li? róklyata e nóva', en: 'Really? The dress is new.' },
        { who: 'me', bg: 'Роклята ти е прекрасна. И имаш красиви очи.', tr: 'róklyata ti e prekrásna. i ímash krasívi ochí', en: 'Your dress is gorgeous. And you have beautiful eyes.', wrong: ['Кафето ти е студено.', 'Къде са ключовете?'] },
        { who: 'wife', bg: 'Ти си най-сладкият мъж!', tr: 'ti si nay-sládkiyat măzh', en: 'You are the sweetest husband!' },
        { who: 'me', bg: 'Обичам усмивката ти.', tr: 'obícham usmívkata ti', en: 'I love your smile.', wrong: ['Обичам сладолед.', 'Обичам футбол.'] },
        { who: 'daughter', bg: 'Тате, хайде! Баба ни чака!', tr: 'táte, háyde! bába ni cháka', en: 'Dad, come on! Grandma is waiting for us!' },
      ],
      questions: [
        { q: 'What is new?', options: ['Her shoes', 'The car', 'The dress'], answer: 2 },
        { q: 'Who is waiting for them?', options: ['Grandma', 'The waiter', 'A friend'], answer: 0 },
      ],
    },
    {
      id: 'love.d3',
      unitId: 'love.u3',
      title: 'Working late',
      titleBg: 'До късно на работа',
      scene: 'You are still at work at nine in the evening. Your wife texts you.',
      emoji: '📱',
      lines: [
        { who: 'wife', bg: 'Кога се прибираш?', tr: 'kogá se pribírash', en: 'When are you coming home?' },
        { who: 'me', bg: 'Скоро ще съм вкъщи.', tr: 'skóro shte săm vkắshti', en: "I'll be home soon.", wrong: ['Сладки сънища, скъпа.', 'Кафето е много хубаво.'] },
        { who: 'wife', bg: 'Децата вече спят. Липсваш ми.', tr: 'detsáta véche spyat. lípsvash mi', en: 'The kids are already asleep. I miss you.' },
        { who: 'me', bg: 'И ти ми липсваш. Мисля за теб.', tr: 'i ti mi lípsvash. míslya za teb', en: "I miss you too. I'm thinking of you.", wrong: ['Има ли хляб вкъщи?', 'Утре ще ходим на море.'] },
        { who: 'wife', bg: 'Чакам те с прегръдка.', tr: 'chákam te s pregrắdka', en: "I'm waiting for you with a hug." },
        { who: 'me', bg: 'Целувки, слънчице!', tr: 'tselúvki, slắnchitse', en: 'Kisses, sunshine!', wrong: ['Добро утро, слънчице!', 'Колко струва, моля?'] },
      ],
      questions: [
        { q: 'What are the kids doing?', options: ['Playing', 'Sleeping', 'Eating'], answer: 1 },
        { q: 'What is your wife waiting for you with?', options: ['Dinner', 'A coffee', 'A hug'], answer: 2 },
      ],
    },
    {
      id: 'love.d4',
      unitId: 'love.u4',
      title: 'Dinner for two',
      titleBg: 'Вечеря за двама',
      scene: 'Date night at a restaurant. The waiter comes to your table.',
      emoji: '🕯️',
      lines: [
        { who: 'waiter', bg: 'Добър вечер! Какво ще пиете?', tr: 'dóbăr vécher! kakvó shte píete', en: 'Good evening! What would you like to drink?' },
        { who: 'me', bg: 'Бутилка червено вино, моля.', tr: 'butílka chervéno víno, mólya', en: 'A bottle of red wine, please.', wrong: ['Сметката, моля.', 'Довиждане, приятен ден.'] },
        { who: 'waiter', bg: 'Веднага!', tr: 'vednága', en: 'Right away!' },
        { who: 'wife', bg: 'Отдавна не сме излизали заедно.', tr: 'otdávna ne sme izlízali záedno', en: "We haven't gone out together in a long time." },
        {
          who: 'me', bg: 'Щастлив съм с теб. Наздраве, любов моя!', tr: 'shtastlív săm s teb. nazdráve, lyubóv móya', en: "I'm happy with you. Cheers, my love!",
          f: { bg: 'Щастлива съм с теб. Наздраве, любов моя!', tr: 'shtastlíva săm s teb. nazdráve, lyubóv móya' },
          wrong: ['Много е студено тук.', 'Къде е тоалетната?'],
        },
        { who: 'wife', bg: 'Наздраве! Искаш ли да танцуваме после?', tr: 'nazdráve! ískash li da tantsúvame pósle', en: 'Cheers! Do you want to dance later?' },
        { who: 'me', bg: 'Да, с удоволствие!', tr: 'da, s udovólstvie', en: 'Yes, with pleasure!', wrong: ['Да, две кафета.', 'Не, аз съм на работа.'] },
      ],
      questions: [
        { q: 'What do you order?', options: ['Coffee', 'Water', 'Red wine'], answer: 2 },
        { q: 'What does your wife suggest for later?', options: ['Dancing', 'Going home', 'Calling grandma'], answer: 0 },
      ],
    },
    {
      id: 'love.d5',
      unitId: 'love.u5',
      title: 'The surprise',
      titleBg: 'Изненадата',
      scene: 'Friday evening. You have secretly planned something for the weekend.',
      emoji: '🎁',
      lines: [
        { who: 'wife', bg: 'Какво ще правим този уикенд?', tr: 'kakvó shte právim tózi uikénd', en: 'What are we doing this weekend?' },
        { who: 'me', bg: 'Имам изненада за теб.', tr: 'ímam iznenáda za teb', en: 'I have a surprise for you.', wrong: ['Утре е понеделник.', 'Не знам, питай майка си.'] },
        { who: 'wife', bg: 'Каква изненада? Кажи ми!', tr: 'kakvá iznenáda? kazhí mi', en: 'What surprise? Tell me!' },
        { who: 'me', bg: 'Резервирах хотел на море. Само ние двамата.', tr: 'rezervírah hotél na moré. sámo níe dvámata', en: 'I booked a hotel at the seaside. Just the two of us.', wrong: ['Купих хляб и мляко.', 'Колата е много мръсна.'] },
        { who: 'wife', bg: 'А децата?', tr: 'a detsáta', en: 'And the kids?' },
        { who: 'me', bg: 'Баба им ще ги гледа.', tr: 'bába im shte gi gléda', en: 'Their grandma will look after them.', wrong: ['Те ядат сладолед.', 'Те са много умни.'] },
        { who: 'wife', bg: 'Ти си невероятен! Обичам те!', tr: 'ti si neveroyáten! obícham te', en: "You're amazing! I love you!" },
      ],
      questions: [
        { q: 'Where is the surprise trip?', options: ['To the mountains', 'To the seaside', 'To the cinema'], answer: 1 },
        { q: 'Who will look after the kids?', options: ['A neighbour', 'A friend', 'Their grandma'], answer: 2 },
      ],
    },
    {
      id: 'love.d6',
      unitId: 'love.u6',
      title: 'Making up',
      titleBg: 'Сдобряване',
      scene: 'You argued about something silly. Now it is very quiet in the kitchen.',
      emoji: '🕊️',
      lines: [
        { who: 'wife', bg: 'Не искам да говоря.', tr: 'ne ískam da govoryá', en: "I don't want to talk." },
        { who: 'me', bg: 'Добре. Тук съм, когато си готова.', tr: 'dobré. tuk săm, kogáto si gotóva', en: "OK. I'm here when you're ready.", wrong: ['Добре. Отивам на футбол.', 'Добре. Какво има за вечеря?'] },
        { who: 'wife', bg: 'Ти никога не ме слушаш!', tr: 'ti níkoga ne me slúshash', en: 'You never listen to me!' },
        { who: 'me', bg: 'Права си. Вината е моя. Прости ми.', tr: 'práva si. vináta e móya. prostí mi', en: "You're right. It's my fault. Forgive me.", wrong: ['Права си. Вината е на майка ти.', 'Хубаво е времето днес.'] },
        { who: 'wife', bg: 'Добре... И аз съжалявам.', tr: 'dobré... i az săzhalyávam', en: "OK... I'm sorry too." },
        { who: 'me', bg: 'Да не се караме повече. Винаги съм до теб.', tr: 'da ne se kárame póveche. vínagi săm do teb', en: "Let's not fight anymore. I'm always here for you.", wrong: ['Да гледаме мач довечера.', 'Да не ядем повече торта.'] },
        { who: 'wife', bg: 'Ела тук. Прегръдка?', tr: 'elá tuk. pregrắdka', en: 'Come here. A hug?' },
      ],
      questions: [
        { q: 'What does your wife say you never do?', options: ['Cook dinner', 'Listen to her', 'Call her mother'], answer: 1 },
        { q: 'How does the argument end?', options: ['With a hug', 'With a match on TV', 'With dinner out'], answer: 0 },
      ],
    },
    {
      id: 'love.d7',
      unitId: 'love.u7',
      title: 'Our anniversary',
      titleBg: 'Нашата годишнина',
      scene: 'It is your wedding anniversary. The kids are asleep and you are looking at old photos.',
      emoji: '💍',
      lines: [
        { who: 'wife', bg: 'Виж тази снимка от сватбата!', tr: 'vizh tázi snímka ot svátbata', en: 'Look at this photo from the wedding!' },
        { who: 'me', bg: 'Помниш ли как се запознахме?', tr: 'pómnish li kak se zapoznáhme', en: 'Do you remember how we met?', wrong: ['Помниш ли къде са ключовете?', 'Знаеш ли колко е часът?'] },
        { who: 'wife', bg: 'Разбира се! На кафе в София. Ти не знаеше нито дума на български.', tr: 'razbíra se! na kafé v sófiya. ti ne znáeshe níto dúma na bắlgarski', en: "Of course! Over coffee in Sofia. You didn't know a single word of Bulgarian." },
        { who: 'me', bg: 'А сега говоря малко! Благодаря ти за всичко.', tr: 'a segá govoryá málko! blagodaryá ti za vsíchko', en: 'And now I speak a little! Thank you for everything.', wrong: ['А сега съм на работа. Чао!', 'А сега искам сладолед.'] },
        { who: 'wife', bg: 'Горда съм с теб.', tr: 'górda săm s teb', en: "I'm proud of you." },
        { who: 'me', bg: 'Ти си най-хубавото нещо в живота ми. Искам да остарея с теб.', tr: 'ti si nay-húbavoto néshto v zhivóta mi. ískam da ostaréya s teb', en: "You're the best thing in my life. I want to grow old with you.", wrong: ['Ти си моята тъща.', 'Искам да спя на дивана.'] },
        { who: 'wife', bg: 'Обичам нашето семейство. Честита годишнина, скъпи!', tr: 'obícham násheto seméystvo. chestíta godíshnina, skắpi', en: 'I love our family. Happy anniversary, darling!' },
      ],
      questions: [
        { q: 'Where did you two meet?', options: ['At a wedding', 'Over coffee in Sofia', 'At the seaside'], answer: 1 },
        { q: 'How much Bulgarian did you know back then?', options: ['Not a single word', 'A few words', 'Everything'], answer: 0 },
      ],
    },
  ],
}
