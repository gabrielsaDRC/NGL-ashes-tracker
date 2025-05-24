import { CharacterData } from '../types';

const STORAGE_KEY = 'character-tracker-data';

export const saveCharacters = (characters: CharacterData[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
};

export const loadCharacters = (): CharacterData[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse characters data', e);
    return [];
  }
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

export const exportData = (): void => {
  const characters = loadCharacters();
  const dataStr = JSON.stringify(characters, null, 2);
  const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
  
  const exportFileDefaultName = `character-data-${new Date().toISOString().slice(0, 10)}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

export const importData = (jsonData: string): boolean => {
  try {
    const data = JSON.parse(jsonData) as CharacterData[];
    saveCharacters(data);
    return true;
  } catch (e) {
    console.error('Failed to import data', e);
    return false;
  }
};