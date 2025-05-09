import { createClient } from '@supabase/supabase-js';

export type CharacterType = 'gathering' | 'processing' | 'crafting';
export type MembershipRole = 'member' | 'admin';
export type MembershipStatus = 'pending' | 'active';
export type SkillRank = 'Novice' | 'Apprentice' | 'Journeyman' | 'Master' | 'Grandmaster';

export type PrimaryClass = 'Bard' | 'Cleric' | 'Fighter' | 'Mage' | 'Ranger' | 'Rogue' | 'Summoner' | 'Tank';

export type EquipmentSlot = 
  | 'head' 
  | 'chest'
  | 'forearms'
  | 'hands'
  | 'belt'
  | 'legs'
  | 'feet'
  | 'shoulders'
  | 'back'
  | 'earring1'
  | 'earring2'
  | 'necklace'
  | 'ring1'
  | 'ring2'
  | 'mainHand1'
  | 'mainHand2'
  | 'offHand1'
  | 'offHand2';

export interface Equipment {
  [key in EquipmentSlot]?: {
    item_guid: string;
    item_name: string;
    rarity: string;
    isTwoHanded?: boolean;
    stats?: Record<string, number>;
  };
}

export const primaryClasses: PrimaryClass[] = [
  'Bard',
  'Cleric',
  'Fighter',
  'Mage',
  'Ranger',
  'Rogue',
  'Summoner',
  'Tank'
];

export const secondaryClasses: Record<PrimaryClass, string[]> = {
  'Bard': ['Minstrel', 'Scryer', 'Bladedancer', 'Sorcerer', 'Bowsinger', 'Charlatan', 'Enchanter', 'Argent'],
  'Cleric': ['Soul Weaver', 'High Priest', 'Highsword', 'Acolyte', 'Soulbow', 'Cultist', 'Necromancer', 'Paladin'],
  'Fighter': ['Tellsword', 'Templar', 'Weapon Master', 'Battle Mage', 'Strider', 'Duelist', 'Wild Blade', 'Knight'],
  'Mage': ['Magician', 'Oracle', 'Spellsword', 'Archwizard', 'Scion', 'Nightspell', 'Spellmancer', 'Spellshield'],
  'Ranger': ['Song Warden', 'Protector', 'Hunter', 'Spellhunter', 'Hawkeye', 'Predator', 'Beastmaster', 'Warden'],
  'Rogue': ['Trickster', 'Shadow Disciple', 'Shadowblade', 'Shadow Caster', 'Scout', 'Assassin', 'Shadowmancer', 'Nightshield'],
  'Summoner': ['Songcaller', 'Shaman', 'Bladecaller', 'Warlock', 'Falconer', 'Shadow Lord', 'Conjurer', 'Keeper'],
  'Tank': ['Siren', 'Apostle', 'Dreadnought', 'Spellstone', 'Sentinel', 'Shadow Guardian', 'Brood Warden', 'Guardian']
};

export interface Guild {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface GuildMembership {
  id: string;
  guild_id: number;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  updated_at: string;
}

export interface SkillData {
  level: number;
  rank: SkillRank;
}

export interface SkillsByType {
  gathering: Record<string, SkillData>;
  processing: Record<string, SkillData>;
  crafting: Record<string, SkillData>;
}

export interface CharacterData {
  id: string;
  name: string;
  type: CharacterType;
  primaryClass: PrimaryClass;
  secondaryClass: string;
  skills: SkillsByType;
  created_at: string;
  updated_at: string;
  user_id: string;
  guild_id: number;
  equipment: Equipment;
}

export interface FormValues {
  name: string;
  type: CharacterType;
  primaryClass: PrimaryClass;
  secondaryClass: string;
  skills: SkillsByType;
  guild_id: number;
}

export const skillsByType: Record<CharacterType, string[]> = {
  gathering: [
    'Fishing',
    'Herbalism',
    'Hunting',
    'Lumberjacking',
    'Mining'
  ],
  processing: [
    'Alchemy',
    'Animal Husbandry',
    'Cooking',
    'Farming',
    'Lumber Milling',
    'Metalworking',
    'Stonemasonry',
    'Tanning',
    'Weaving'
  ],
  crafting: [
    'Arcane Engineering',
    'Armor Smithing',
    'Carpentry',
    'Leatherworking',
    'Jeweler',
    'Scribe',
    'Tailoring',
    'Weapon Smithing'
  ]
};

export const ranks: SkillRank[] = ['Novice', 'Apprentice', 'Journeyman', 'Master', 'Grandmaster'];

export const initializeSkills = (): SkillsByType => {
  const skills: SkillsByType = {
    gathering: {},
    processing: {},
    crafting: {}
  };

  Object.entries(skillsByType).forEach(([type, typeSkills]) => {
    typeSkills.forEach(skill => {
      skills[type as CharacterType][skill] = { level: 0, rank: 'Novice' };
    });
  });

  return skills;
};