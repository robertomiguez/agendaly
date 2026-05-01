import { supabase } from '../lib/supabase'
import type { Ad } from '../types'

export const adService = {
    async getActiveAd(placement: string) {
        const now = new Date().toISOString()
        const { data, error } = await supabase
            .from('ads')
            .select('id,title,description,link_url,image_url,placement,priority,start_at,end_at')
            .contains('placement', [placement])
            .eq('is_active', true)
            .or(`start_at.is.null,start_at.lte.${now}`)
            .or(`end_at.is.null,end_at.gte.${now}`)

        if (error || !data || data.length === 0) {
            if (error) console.error('[adService] Error fetching active ads:', error)
            return null
        }

        const ads = data as Ad[]

        // Priority-Weighted Random Selection
        // Weight = priority + 1 (so priority 0 still gets a chance)
        const weights = ads.map(ad => Math.max(0, ad.priority || 0) + 1)
        const totalWeight = weights.reduce((sum, w) => sum + w, 0)

        let randomValue = Math.random() * totalWeight

        for (let i = 0; i < ads.length; i++) {
            const weight = weights[i] ?? 0
            if (randomValue < weight) {
                return ads[i]
            }
            randomValue -= weight
        }

        return ads[0] // Fallback to first ad
    },

    async trackClick(adId: string) {
        const { error } = await supabase.rpc('increment_ad_clicks', { ad_id: adId })
        if (error) {
            console.error('[adService] Click tracking failed:', error)
        }
    }
}
