import { supabase } from '../supabaseClient';

export const partsService = {
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

  async addPart(part: { part_name: string; part_number?: string; notes?: string }) {
    const { data, error } = await supabase
      .from('parts')
      .insert([part])
      .select();

    if (error) {
      console.error('Error adding part:', error);
      throw error;
    }
    return data[0];
  }
};
