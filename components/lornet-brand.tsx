type LornetBrandProps = {
  compact?: boolean
  markClassName?: string
  wordClassName?: string
}

export const LORNET_LOGO_SOURCE = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Gemini_Generated_Image_3ce3wu3ce3wu3ce3-removebg-preview-Fo094NEoSeCJ5INv7PGtTQ8pOHEweT.png'

export function LornetBrand({ compact = false, markClassName = '', wordClassName = '' }: LornetBrandProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ${markClassName}`}>
        <img src={LORNET_LOGO_SOURCE} alt="" referrerPolicy="no-referrer" decoding="async" className="size-full object-contain" />
      </span>
      {!compact && <span className={`text-[20px] font-semibold tracking-[-.06em] ${wordClassName}`}>lornet<span className="text-emerald-600">.</span></span>}
    </span>
  )
}
