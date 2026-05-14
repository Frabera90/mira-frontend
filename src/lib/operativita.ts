export const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 7]

const PRANZO = 101
const CENA = 102
const LUNCH_START = 10000
const LUNCH_END = 20000
const DINNER_START = 30000
const DINNER_END = 40000

export interface Operativita {
  giorni: number[]
  pranzo: boolean
  cena: boolean
  pranzo_dalle: string
  pranzo_alle: string
  cena_dalle: string
  cena_alle: string
}

function toMinutes(value: string, fallback: string) {
  const [h, m] = (value || fallback).slice(0, 5).split(':').map(Number)
  return Math.max(0, Math.min(1439, (h || 0) * 60 + (m || 0)))
}

function fromMinutes(minutes: number) {
  const safe = Math.max(0, Math.min(1439, Number(minutes) || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function readTime(values: number[], base: number, fallback: string) {
  const found = values.find(v => Number.isInteger(v) && v >= base && v < base + 1440)
  return found ? fromMinutes(found - base) : fallback
}

export function parseOperativita(giorniApertura: unknown): Operativita {
  const values = Array.isArray(giorniApertura)
    ? giorniApertura.map(Number).filter(Number.isFinite)
    : []
  const giorni = values.filter(v => v >= 1 && v <= 7)
  const explicit = values.includes(PRANZO) || values.includes(CENA)

  return {
    giorni: giorni.length ? giorni : DEFAULT_DAYS,
    pranzo: explicit ? values.includes(PRANZO) : false,
    cena: explicit ? values.includes(CENA) : true,
    pranzo_dalle: readTime(values, LUNCH_START, '12:00'),
    pranzo_alle: readTime(values, LUNCH_END, '15:00'),
    cena_dalle: readTime(values, DINNER_START, '20:00'),
    cena_alle: readTime(values, DINNER_END, '23:30'),
  }
}

export function encodeOperativita(op: Operativita) {
  const out = [...new Set(op.giorni.map(Number).filter(v => v >= 1 && v <= 7))]
  if (op.pranzo) out.push(PRANZO)
  if (op.cena) out.push(CENA)
  out.push(LUNCH_START + toMinutes(op.pranzo_dalle, '12:00'))
  out.push(LUNCH_END + toMinutes(op.pranzo_alle, '15:00'))
  out.push(DINNER_START + toMinutes(op.cena_dalle, '20:00'))
  out.push(DINNER_END + toMinutes(op.cena_alle, '23:30'))
  return out
}

export function promptTime(start: string) {
  return fromMinutes(toMinutes(start, '12:00') - 60)
}
