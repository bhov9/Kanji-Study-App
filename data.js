import { curriculumGrades } from './curriculum.js';
import { gradeVocabulary } from './grade-vocabulary.js';
import { furiganaSource, readingMappings } from './reading-mappings.js';

// Stable word IDs are stored in review history. Keep them when editing a word.
// Component notes describe visible shapes. Mnemonics are invented memory aids.
const wordRows = [
  ['yakusoku', '約束', 'やくそく', 'Promise', ['やく', 'そく']],
  ['hanataba', '花束', 'はなたば', 'Bouquet of flowers', ['はな', 'たば']],
  ['yakubun', '約分', 'やくぶん', 'Reducing a fraction', ['やく', 'ぶん']],
  ['hanabi', '花火', 'はなび', 'Fireworks', ['はな', 'び']],
  ['kazan', '火山', 'かざん', 'Volcano', ['か', 'ざん']],
  ['tozan', '登山', 'とざん', 'Mountain climbing', ['と', 'ざん']],
  ['jinkou', '人口', 'じんこう', 'Population', ['じん', 'こう']],
  ['jinsei', '人生', 'じんせい', 'A person’s life', ['じん', 'せい']],
  ['gakusei', '学生', 'がくせい', 'Student', ['がく', 'せい']],
  ['gakkou', '学校', 'がっこう', 'School', ['がっ', 'こう']],
  ['koumon', '校門', 'こうもん', 'School gate', ['こう', 'もん']],
  ['monban', '門番', 'もんばん', 'Gatekeeper', ['もん', 'ばん']],
  ['bangou', '番号', 'ばんごう', 'Number (as an identifier)', ['ばん', 'ごう']],
  ['shingou', '信号', 'しんごう', 'Signal or traffic light', ['しん', 'ごう']],
  ['shinrai', '信頼', 'しんらい', 'Trust or reliance', ['しん', 'らい']],
  ['irai', '依頼', 'いらい', 'Request', ['い', 'らい']],
  ['mizuumi', '湖', 'みずうみ', 'Lake'],
  ['suibun', '水分', 'すいぶん', 'Moisture or water content', ['すい', 'ぶん']],
  ['suisha', '水車', 'すいしゃ', 'Waterwheel', ['すい', 'しゃ']],
  ['densha', '電車', 'でんしゃ', 'Electric train', ['でん', 'しゃ']],
  ['denwa', '電話', 'でんわ', 'Telephone call', ['でん', 'わ']],
  ['kaiwa', '会話', 'かいわ', 'Conversation', ['かい', 'わ']],
  ['kaisha', '会社', 'かいしゃ', 'Company', ['かい', 'しゃ']],
  ['shakai', '社会', 'しゃかい', 'Society', ['しゃ', 'かい']],
  ['shimbun', '新聞', 'しんぶん', 'Newspaper', ['しん', 'ぶん']],
  ['shinsha', '新車', 'しんしゃ', 'New vehicle', ['しん', 'しゃ']],
];

// Each value is [visible component labels, structural description, optional mnemonic].
export const kanjiNotes = {
  約: ['糸 thread · 勺 ladle', 'The narrow form of 糸 sits to the left of 勺.', 'Tie a thread around a ladle to seal a promise.'],
  束: ['木 tree shape · 口 box shape', 'A box crosses the central stem of the tree-like outline.', 'Draw a band around a bunch of sticks to make a bundle.'],
  花: ['艹 grass · 化 change', 'The grass crown sits above 化.', 'Watch a patch of grass change as the flowers bloom.'],
  分: ['八 split shape · 刀 blade', 'Two spreading strokes sit above 刀.', 'A blade divides something into two parts.'],
  火: ['火 fire', 'Two smaller strokes flank the tall central stroke and its sweeping right leg.'],
  山: ['山 mountain', 'Three uprights share a base, with the tallest peak in the middle.'],
  登: ['癶 spreading strokes · 豆 bean', 'The upper strokes spread outward over 豆.'],
  口: ['口 mouth', 'Draw a left side, then the top and right in one stroke, then close the bottom.'],
  人: ['人 person', 'A long left sweep supports a shorter stroke sweeping to the right.'],
  生: ['生 life', 'A short sweep starts above three horizontal bars crossed by a vertical stem.', 'Picture a stem growing out of the ground.'],
  学: ['⺍ three-stroke top · 冖 cover · 子 child', 'The three marks and cover sit above 子.', 'A child studies under a roof.'],
  校: ['木 tree · 交 crossing', '木 narrows on the left, and 交 fills the right.', 'Cross by the tree on the way to school.'],
  門: ['門 gate', 'Write two tall panels facing each other with open space down the middle.'],
  番: ['釆 distinguishing shape · 田 field', 'The spreading upper shape sits over 田.', 'Imagine numbering each field in order.'],
  号: ['口 mouth · 丂 hooked shape', 'A small 口 sits above a horizontal bar with a hooked stroke below.', 'Call out a number and hang it on a hook.'],
  信: ['亻 person · 言 words', 'The narrow person form sits to the left of 言.', 'You trust a person who keeps their word.'],
  頼: ['束 bundle · 頁 head', '束 fills the left side and 頁 fills the right.', 'Rely on someone to help carry a bundle balanced on your head.'],
  依: ['亻 person · 衣 clothing', 'The narrow person form sits to the left of 衣.'],
  湖: ['氵 water · 胡 right component', 'Three water strokes sit to the left of 胡, which visibly contains 古 and 月.', 'An old moon reflects in the lake.'],
  水: ['水 water', 'A hooked vertical stroke is flanked by a bent stroke on the left and two sweeps on the right.'],
  車: ['車 vehicle', 'A central vertical line passes through a boxed middle and the bars above and below.'],
  電: ['雨 rain · hooked lower shape', 'A rain crown sits above a box crossed by a vertical stroke that hooks to the right.', 'Picture a flash of electricity bending out from under a rain cloud.'],
  話: ['言 words · 舌 tongue', '言 sits to the left of 舌.', 'Words come from the tongue when you speak.'],
  会: ['𠆢 roof shape · 云 lower component', 'The two sloping strokes shelter 云.', 'Imagine people meeting beneath a roof.'],
  社: ['礻 altar · 土 earth', 'The narrow altar form sits beside 土.', 'Picture a community gathering around an altar on a patch of earth.'],
  新: ['立 stand · 木 tree · 斤 axe', 'The left side resembles 立 above 木. The axe shape 斤 sits to the right.', 'Cut a new piece of wood with an axe.'],
  聞: ['門 gate · 耳 ear', '耳 is enclosed by 門.', 'Put your ear to the gate to hear what is happening.'],
};

// Optional reading parts align with each written code point, including kana.
export const words = [...wordRows, ...gradeVocabulary].map(([id, spelling, reading, meaning, readingParts]) => {
  const characters = [...new Set(spelling)].filter(character => curriculumGrades.has(character));
  const mapped = readingMappings[id];
  const readingMappingSource = readingParts ? (id.startsWith('jmdict:') ? 'KANJIDIC2 alignment' : 'Starter deck') :
    mapped ? furiganaSource : null;
  return { id, spelling, reading, meaning, readingParts: readingParts ?? mapped, readingMappingSource, characters,
    grades: [...new Set(characters.map(character => curriculumGrades.get(character)))] };
});
