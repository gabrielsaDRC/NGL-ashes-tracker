import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FormValues, CharacterType, skillsByType, SkillData, ranks, primaryClasses, secondaryClasses, PrimaryClass, initializeSkills } from '../types';

interface CharacterFormProps {
  initialValues?: FormValues;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}

const defaultValues: FormValues = {
  name: '',
  type: 'gathering',
  primary_class: 'Fighter',
  secondary_class: '',
  skills: initializeSkills(),
  guild_id: 0
};

const CharacterForm: React.FC<CharacterFormProps> = ({ 
  initialValues, 
  onSubmit, 
  onCancel 
}) => {
  const [values, setValues] = useState<FormValues>(initialValues || defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handlePrimaryClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const primary_class = e.target.value as PrimaryClass;
    setValues(prev => ({
      ...prev,
      primary_class,
      secondary_class: ''
    }));
  };

  const handleSkillChange = (category: CharacterType, skillName: string, field: 'level' | 'rank', value: string) => {
    setValues(prev => ({
      ...prev,
      skills: {
        ...prev.skills,
        [category]: {
          ...prev.skills[category],
          [skillName]: {
            ...prev.skills[category][skillName],
            [field]: field === 'level' 
              ? Math.min(100, Math.max(0, parseInt(value, 10) || 0))
              : value
          }
        }
      }
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!values.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!values.primary_class) {
      newErrors.primary_class = 'Primary class is required';
    }
    
    if (!values.secondary_class) {
      newErrors.secondary_class = 'Secondary class is required';
    }

    // Validate skills for each category
    Object.entries(skillsByType).forEach(([category, skills]) => {
      skills.forEach(skillName => {
        const skillData = values.skills[category as CharacterType][skillName];
        if (!skillData || skillData.level < 0 || skillData.level > 100) {
          newErrors[`skills.${category}.${skillName}.level`] = 'Skill level must be between 0 and 100';
        }
        if (!skillData || !ranks.includes(skillData.rank)) {
          newErrors[`skills.${category}.${skillName}.rank`] = 'Invalid skill rank';
        }
      });
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      try {
        setIsSubmitting(true);
        await onSubmit(values);
        toast.success(initialValues ? 'Character updated successfully' : 'Character created successfully');
      } catch (error) {
        console.error('Error submitting character:', error);
        toast.error('Failed to save character');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="bg-white bg-gray-with-oppacity  rounded-lg shadow-md p-6 animate-fadeIn">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
        {initialValues ? 'Edit Character' : 'Add New Character'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Character Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={values.name}
            onChange={handleChange}
            className={`w-full px-3 py-2 border ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white`}
            placeholder="Enter character name"
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Character Type
            </label>
            <select
              id="type"
              name="type"
              value={values.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isSubmitting}
            >
              <option value="gathering">Gathering</option>
              <option value="processing">Processing</option>
              <option value="crafting">Crafting</option>
            </select>
          </div>

          <div>
            <label htmlFor="primary_class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Class
            </label>
            <select
              id="primary_class"
              name="primary_class"
              value={values.primary_class}
              onChange={handlePrimaryClassChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isSubmitting}
            >
              {primaryClasses.map(className => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
            {errors.primary_class && (
              <p className="mt-1 text-sm text-red-600">{errors.primary_class}</p>
            )}
          </div>

          <div>
            <label htmlFor="secondary_class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Secondary Class
            </label>
            <select
              id="secondary_class"
              name="secondary_class"
              value={values.secondary_class}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={!values.primary_class || isSubmitting}
            >
              <option value="">Select Secondary Class</option>
              {values.primary_class && secondaryClasses[values.primary_class].map(className => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
            {errors.secondary_class && (
              <p className="mt-1 text-sm text-red-600">{errors.secondary_class}</p>
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Skills</h3>
          <div className="space-y-6">
            {(Object.entries(skillsByType) as [CharacterType, string[]][]).map(([category, skills]) => (
              <div key={category} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4 capitalize">{category}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {skills.map(skillName => (
                    <div key={skillName} className="bg-white bg-gray-with-oppacity  p-4 rounded-lg shadow-sm">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{skillName}</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Level</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={values.skills[category][skillName]?.level || 0}
                            onChange={(e) => handleSkillChange(category, skillName, 'level', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                            disabled={isSubmitting}
                          />
                          {errors[`skills.${category}.${skillName}.level`] && (
                            <p className="mt-1 text-xs text-red-600">{errors[`skills.${category}.${skillName}.level`]}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400">Rank</label>
                          <select
                            value={values.skills[category][skillName]?.rank || 'Novice'}
                            onChange={(e) => handleSkillChange(category, skillName, 'rank', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                            disabled={isSubmitting}
                          >
                            {ranks.map(rank => (
                              <option key={rank} value={rank}>{rank}</option>
                            ))}
                          </select>
                          {errors[`skills.${category}.${skillName}.rank`] && (
                            <p className="mt-1 text-xs text-red-600">{errors[`skills.${category}.${skillName}.rank`]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : initialValues ? 'Update Character' : 'Add Character'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CharacterForm;

export { CharacterForm };