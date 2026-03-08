import { supabase } from '../supabaseClient';

export const partsService = {
  // Pulls all parts to display on your dashboard
  async getParts() {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching parts:', error);
      return [];
    }
    return data || [];
  },

  // Saves a new part with all the visual data (steps, status, etc.)
  async addPart(part: any) {
    const { data, error } = await supabase
      .from('parts')
      .insert([{
        ...part,
        // Ensures the database stores the complex 'steps' array correctly
        steps: JSON.stringify(part.steps || []),
        lifecyclePhases: JSON.stringify(part.lifecyclePhases || [])
      }])
      .select();

    if (error) {
      console.error('Error adding part:', error);
      throw error;
    }
    return data[0];
  }
};
