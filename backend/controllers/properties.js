/**
 * NEXTEP CRM - Properties Controller
 * Gestão de Imóveis
 */

const toNum = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);

exports.list = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const {
      page = 1, limit = 20, search,
      type, city, neighborhood,
      min_price, max_price, status,
      transaction_type, bedrooms
    } = req.query;

    let query = supabase
      .from('properties')
      .select(`
        *,
        owner:owner_id (id, name, phone),
        assigned:assigned_to (id, name, avatar_url)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);
    if (city) query = query.ilike('city', `%${city}%`);
    if (neighborhood) query = query.ilike('neighborhood', `%${neighborhood}%`);
    if (status) query = query.eq('status', status);
    if (transaction_type) query = query.eq('transaction_type', transaction_type);
    if (bedrooms) query = query.gte('bedrooms', parseInt(bedrooms));
    if (min_price) query = query.gte('price', parseFloat(min_price));
    if (max_price) query = query.lte('price', parseFloat(max_price));
    if (search) {
      query = query.or(`title.ilike.%${search}%,code.ilike.%${search}%,address.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
    });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar imóveis' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;

    const { data: property, error } = await supabase
      .from('properties')
      .select(`
        *,
        owner:owner_id (id, name, phone, email),
        assigned:assigned_to (id, name, avatar_url)
      `)
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .is('deleted_at', null)
      .single();

    if (error || !property) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    // Incrementar visualizações
    await supabase.from('properties')
      .update({ views_count: property.views_count + 1 })
      .eq('id', id);

    // Interesses
    const { data: interests } = await supabase
      .from('property_interests')
      .select(`
        id, interest_type, status, created_at,
        lead:lead_id (id, name, phone),
        client:client_id (id, name, phone)
      `)
      .eq('property_id', id)
      .eq('company_id', req.user.companyId)
      .order('created_at', { ascending: false });

    res.json({ ...property, interests: interests || [] });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar imóvel' });
  }
};

exports.create = async (req, res) => {
  try {
    const supabase = req.supabase;
    const companyId = req.user.companyId;
    const data = req.body;

    // Gerar código único
    const code = `IMV-${Date.now().toString(36).toUpperCase()}`;

    const propertyData = {
      company_id: companyId,
      code,
      owner_id: data.owner_id,
      assigned_to: data.assigned_to || req.user.userId,
      type: data.type,
      subtype: data.subtype,
      title: data.title,
      description: data.description,
      address: data.address,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      cep: data.cep,
      latitude: data.latitude,
      longitude: data.longitude,
      area_total: toNum(data.area_total),
      area_util: toNum(data.area_util),
      bedrooms: toNum(data.bedrooms),
      suites: toNum(data.suites),
      bathrooms: toNum(data.bathrooms),
      parking_spots: toNum(data.parking_spots),
      floors: toNum(data.floors),
      construction_year: toNum(data.construction_year),
      price: toNum(data.price),
      price_rent: toNum(data.price_rent),
      price_condo: toNum(data.price_condo),
      price_iptu: toNum(data.price_iptu),
      transaction_type: data.transaction_type,
      status: data.status || 'available',
      photos: data.photos || [],
      videos: data.videos || [],
      tags: data.tags || [],
      notes: data.notes
    };

    const { data: property, error } = await supabase
      .from('properties')
      .insert([propertyData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Imóvel cadastrado', property });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar imóvel', details: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase;

    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    delete updateData.company_id;
    delete updateData.code;
    ['area_total', 'area_util', 'bedrooms', 'suites', 'bathrooms', 'parking_spots', 'floors', 'construction_year', 'price', 'price_rent', 'price_condo', 'price_iptu'].forEach(f => {
      if (f in updateData) updateData[f] = toNum(updateData[f]);
    });

    const { data: property, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', req.user.companyId)
      .select()
      .single();

    if (error || !property) {
      return res.status(404).json({ error: 'Imóvel não encontrado' });
    }

    res.json({ message: 'Imóvel atualizado', property });

  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar imóvel' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await req.supabase
      .from('properties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', req.user.companyId);

    res.json({ message: 'Imóvel removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover imóvel' });
  }
};
