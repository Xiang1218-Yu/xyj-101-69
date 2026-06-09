import type { StoryInput } from '@/store/useStore'

export interface StoryPageTemplate {
  text: string
  illustrationPrompt: string
  pageType: 'cover' | 'story' | 'back'
}

interface TemplateVariant {
  text: string
  illustrationPrompt: string
}

const zhEventTemplates: TemplateVariant[] = [
  {
    text: '这天，{childName}{experience}。阳光洒在身上，{childName}的心情像彩虹一样美丽。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} {experience} in a sunny day with rainbow in sky, {animal} friend beside, warm pastel colors, watercolor style, joyful children storybook art'
  },
  {
    text: '还记得那天，{childName}{experience}。{animal}朋友在一旁眨着大眼睛，仿佛也在为{childName}高兴呢！',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} {experience} with excited {animal} friend watching, big sparkly eyes, soft warm lighting, watercolor texture, cozy children storybook illustration'
  },
  {
    text: '有一天，{childName}{experience}。微风轻轻吹过，带来了花朵的香气，也带来了这份美好的记忆。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} {experience} in a flower garden with gentle breeze, {animal} friend enjoying the moment, dreamy pastel colors, watercolor style, magical children storybook art'
  },
  {
    text: '那是一个特别的日子，{childName}{experience}。{childName}把这件事悄悄地告诉了{animal}朋友，这是他们之间的小秘密。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} whispering to {animal} friend about {experience}, cozy and intimate moment, soft sunset light, watercolor texture, heartwarming children storybook art'
  },
  {
    text: '每当{childName}想起{experience}的那天，嘴角就会不自觉地微笑。{animal}朋友也会开心地摇着尾巴。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} smiling while thinking about {experience}, {animal} friend wagging tail happily, soft cloud background with thought bubbles, watercolor style, cheerful children storybook art'
  },
  {
    text: '最让{childName}难忘的，是{experience}的那天。{animal}朋友用小爪子轻轻拍了拍{childName}，好像在说"太棒啦！"',
    illustrationPrompt: 'Cute chibi style illustration of {animal} friend giving a high-five to child {childName} after {experience}, celebratory moment with confetti, warm pastel colors, watercolor texture, joyful children storybook illustration'
  },
]

const zhTransitionTemplates: TemplateVariant[] = [
  {
    text: '坐在柔软的草地上，{childName}和{animal}望着远方的云朵。"我们去探索更大的世界吧！"{childName}大声说。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} sitting on soft grass looking at distant clouds, dreaming of adventures, warm golden hour light, watercolor style, dreamy children storybook art'
  },
  {
    text: '{animal}朋友兴奋地蹦蹦跳跳，它拉着{childName}的小手，一起踏上了寻找神奇星星的旅程。',
    illustrationPrompt: 'Cute chibi style illustration of excited {animal} pulling child {childName} by the hand on a journey to find magical stars, magical forest path, sparkles in air, watercolor texture, adventurous children storybook art'
  },
  {
    text: '夜晚的星空闪闪发光，{childName}和{animal}跟着一颗特别亮的星星，开始了奇妙的冒险。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} following a bright star in the night sky, magical starlit path, fireflies dancing around, watercolor style, whimsical children storybook illustration'
  },
  {
    text: '在彩虹的尽头，{childName}发现了一扇闪闪发光的门。{animal}朋友深吸一口气，和{childName}一起推开了它。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} pushing open a sparkling magical door at the end of a rainbow, mystical light pouring out, watercolor texture, magical children storybook art'
  },
  {
    text: '穿过开满鲜花的小径，{childName}和{animal}来到了一个从未见过的美丽地方。"哇～"他们同时发出了惊叹。',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} discovering a beautiful magical meadow full of flowers, amazed expressions, soft pastel colors, watercolor style, enchanting children storybook illustration'
  },
]

const enEventTemplates: TemplateVariant[] = [
  {
    text: 'One sunny day, {childName} {experience}. The sun was shining, and {childName}\'s heart felt as bright as a rainbow.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} {experience} in a sunny day with rainbow in sky, {animal} friend beside, warm pastel colors, watercolor style, joyful children storybook art'
  },
  {
    text: 'Remember that day when {childName} {experience}? The {animal} friend watched with big sparkly eyes, so happy for {childName}!',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} {experience} with excited {animal} friend watching, big sparkly eyes, soft warm lighting, watercolor texture, cozy children storybook illustration'
  },
  {
    text: 'There was one special day when {childName} {experience}. A gentle breeze blew, carrying flower scents and beautiful memories.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} {experience} in a flower garden with gentle breeze, {animal} friend enjoying the moment, dreamy pastel colors, watercolor style, magical children storybook art'
  },
  {
    text: 'That extraordinary day, {childName} {experience}. It was their little secret, shared only between {childName} and the {animal} friend.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} whispering to {animal} friend about {experience}, cozy and intimate moment, soft sunset light, watercolor texture, heartwarming children storybook art'
  },
  {
    text: 'Every time {childName} thinks about {experience}, a big smile appears. The {animal} friend wags its tail happily too.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} smiling while thinking about {experience}, {animal} friend wagging tail happily, soft cloud background with thought bubbles, watercolor style, cheerful children storybook art'
  },
  {
    text: 'The most unforgettable moment was when {childName} {experience}. The {animal} friend gave a high-five, as if saying "You did it!"',
    illustrationPrompt: 'Cute chibi style illustration of {animal} friend giving a high-five to child {childName} after {experience}, celebratory moment with confetti, warm pastel colors, watercolor texture, joyful children storybook illustration'
  },
]

const enTransitionTemplates: TemplateVariant[] = [
  {
    text: 'Sitting on the soft grass, {childName} and {animal} watched the distant clouds. "Let\'s explore the big wide world!" said {childName}.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} sitting on soft grass looking at distant clouds, dreaming of adventures, warm golden hour light, watercolor style, dreamy children storybook art'
  },
  {
    text: 'The {animal} friend bounced excitedly, holding {childName}\'s hand, as they set off to find the magical star.',
    illustrationPrompt: 'Cute chibi style illustration of excited {animal} pulling child {childName} by the hand on a journey to find magical stars, magical forest path, sparkles in air, watercolor texture, adventurous children storybook art'
  },
  {
    text: 'Under the twinkling night sky, {childName} and {animal} followed an extra bright star, beginning their wonderful adventure.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} following a bright star in the night sky, magical starlit path, fireflies dancing around, watercolor style, whimsical children storybook illustration'
  },
  {
    text: 'At the end of the rainbow, {childName} found a sparkling door. The {animal} took a deep breath, and together they pushed it open.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} pushing open a sparkling magical door at the end of a rainbow, mystical light pouring out, watercolor texture, magical children storybook art'
  },
  {
    text: 'Through the flower-lined path, {childName} and {animal} arrived at a beautiful place they\'d never seen. "Wow~" they both gasped.',
    illustrationPrompt: 'Cute chibi style illustration of child {childName} and {animal} discovering a beautiful magical meadow full of flowers, amazed expressions, soft pastel colors, watercolor style, enchanting children storybook illustration'
  },
]

function fillTemplate(template: string, input: StoryInput, experience?: string): string {
  let result = template
    .replace(/\{childName\}/g, input.childName)
    .replace(/\{animal\}/g, input.favoriteAnimal)
  
  if (experience !== undefined) {
    result = result.replace(/\{experience\}/g, experience)
  }
  
  return result
}

export function generateStory(input: StoryInput): { title: string; pages: StoryPageTemplate[] } {
  const experiences = input.recentExperiences
  const eventTemplates = input.language === 'zh' ? zhEventTemplates : enEventTemplates
  const transitionTemplates = input.language === 'zh' ? zhTransitionTemplates : enTransitionTemplates

  const pages: StoryPageTemplate[] = []

  const coverText = input.language === 'zh' 
    ? `《${input.childName}的奇妙冒险》`
    : `${input.childName}'s Wonderful Adventure`
  
  const coverPrompt = `A cute chibi style illustration of a happy child named ${input.childName} with rosy cheeks and big sparkly eyes, standing on a colorful pastel candy-colored planet with a fluffy cute ${input.favoriteAnimal} friend, surrounded by twinkling stars and soft clouds, warm and cozy children storybook illustration, soft watercolor texture, gentle pastel colors of pink, mint green and lavender, dreamy and magical atmosphere`

  pages.push({
    text: coverText,
    illustrationPrompt: coverPrompt,
    pageType: 'cover',
  })

  const introText = input.language === 'zh'
    ? `在一个充满阳光的日子里，${input.childName}和最好的朋友${input.favoriteAnimal}一起玩耍。他们是最要好的伙伴，每天都形影不离！`
    : `On a bright sunny day, ${input.childName} played with best friend ${input.favoriteAnimal}. They were the very best of pals, always together!`
  
  const introPrompt = `Cute chibi style illustration of a child ${input.childName} playing happily with a fluffy ${input.favoriteAnimal} in a sunny garden full of colorful flowers and butterflies, gentle sunlight filtering through trees, warm pastel colors, soft watercolor texture, cheerful and joyful children storybook illustration`

  pages.push({
    text: introText,
    illustrationPrompt: introPrompt,
    pageType: 'story',
  })

  experiences.forEach((exp, index) => {
    const eventTemplate = eventTemplates[index % eventTemplates.length]
    pages.push({
      text: fillTemplate(eventTemplate.text, input, exp),
      illustrationPrompt: fillTemplate(eventTemplate.illustrationPrompt, input, exp),
      pageType: 'story',
    })

    if (index < experiences.length - 1) {
      const transitionTemplate = transitionTemplates[index % transitionTemplates.length]
      pages.push({
        text: fillTemplate(transitionTemplate.text, input, exp),
        illustrationPrompt: fillTemplate(transitionTemplate.illustrationPrompt, input, exp),
        pageType: 'story',
      })
    }
  })

  const conclusionText = input.language === 'zh'
    ? `经过这么多美好的事情，${input.childName}明白了：每一段经历都很珍贵，都是成长的礼物。而最幸福的事，就是一路有${input.favoriteAnimal}朋友的陪伴。`
    : `After all these wonderful moments, ${input.childName} learned: every experience is precious, a gift of growth. And the happiest thing of all is having ${input.favoriteAnimal} friend along the way.`
  
  const conclusionPrompt = `Cute chibi style illustration of child ${input.childName} hugging a fluffy ${input.favoriteAnimal} warmly at a beautiful hilltop viewpoint overlooking a sunset valley, with tiny hearts floating around them, warm orange and pink sunset colors, soft watercolor style, heartwarming and cozy children storybook art`

  pages.push({
    text: conclusionText,
    illustrationPrompt: conclusionPrompt,
    pageType: 'story',
  })

  const backText = input.language === 'zh'
    ? `这是属于${input.childName}的故事。每一颗星星，都在为你闪耀。晚安，小朋友～`
    : `This is ${input.childName}'s story. Every star shines just for you. Good night, little one～`
  
  const backPrompt = `Cute chibi style illustration of child ${input.childName} and ${input.favoriteAnimal} waving goodbye from a beautiful pastel planet, with tiny stars forming a heart shape in the sky, soft dreamy sunset colors of pink, orange and purple, warm and heartfelt children storybook illustration, watercolor texture`

  pages.push({
    text: backText,
    illustrationPrompt: backPrompt,
    pageType: 'back',
  })

  const title = coverText.replace(/[《》"]/g, '')

  return { title, pages }
}
