// Run ERP Shipping API client
// Docs: see public/RUN API Documentation.pdf
// All requests are GET to https://<HOST>/RunCom.Server/Request.aspx

const HOST          = (process.env.RUN_HOST || '').trim()
const CUSTOMER_NUM  = (process.env.RUN_CUSTOMER_NUMBER || '').trim()
const SHIPMENT_TYPE = (process.env.RUN_SHIPMENT_TYPE || '').trim()
const CARGO_TYPE    = (process.env.RUN_CARGO_TYPE || '').trim()
const AUTH_TOKEN    = (process.env.RUN_AUTH_TOKEN || '').trim()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(val?: string | number) { return `-N${val ?? ''}` }
function a(val?: string)          { return `-A${val ?? ''}` }

function runUrl(program: string, args: string): string {
  const base = `https://${HOST}/RunCom.Server/Request.aspx`
  return `${base}?APPNAME=run&PRGNAME=${program}&ARGUMENTS=${encodeURIComponent(args)}`
}

function headers(): HeadersInit {
  return {}
}

function xmlTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, 's'))
  return m?.[1]?.trim() ?? ''
}

// ─── Address parsing ──────────────────────────────────────────────────────────
// Supported formats:
//   "הרצל 11 קומה 2 דירה 3, תל אביב"   → street=הרצל, building=11, floor=2, apt=3
//   "הרצל 11/3, תל אביב"               → street=הרצל, building=11, apt=3
//   "הרצל 11, תל אביב"                 → street=הרצל, building=11
//   "הרצל 11 דירה 3, תל אביב"          → street=הרצל, building=11, apt=3

export interface ParsedAddress {
  city:      string
  street:    string
  building:  string
  floor:     string
  apartment: string
}

export function parseAddress(address: string): ParsedAddress {
  const empty: ParsedAddress = { city: '', street: '', building: '', floor: '', apartment: '' }
  if (!address) return empty

  // City = everything after last comma
  const lastComma = address.lastIndexOf(',')
  if (lastComma === -1) return { ...empty, street: address.trim() }

  const city      = address.slice(lastComma + 1).trim()
  const streetRaw = address.slice(0, lastComma).trim()

  // Pattern: "רחוב 11 קומה 2 דירה 3"
  const full = streetRaw.match(/^(.+?)\s+(\d+)\s+קומה\s+(\d+)\s+דירה\s+(\d+)\s*$/i)
  if (full) return { city, street: full[1].trim(), building: full[2], floor: full[3], apartment: full[4] }

  // Pattern: "רחוב 11 דירה 3"
  const withApt = streetRaw.match(/^(.+?)\s+(\d+)\s+דירה\s+(\d+)\s*$/i)
  if (withApt) return { city, street: withApt[1].trim(), building: withApt[2], floor: '', apartment: withApt[3] }

  // Pattern: "רחוב 11 קומה 2"
  const withFloor = streetRaw.match(/^(.+?)\s+(\d+)\s+קומה\s+(\d+)\s*$/i)
  if (withFloor) return { city, street: withFloor[1].trim(), building: withFloor[2], floor: withFloor[3], apartment: '' }

  // Pattern: "רחוב 11/3" (building/apartment)
  const slash = streetRaw.match(/^(.+?)\s+(\d+)\/(\d+)\s*$/)
  if (slash) return { city, street: slash[1].trim(), building: slash[2], floor: '', apartment: slash[3] }

  // Pattern: "רחוב 11"
  const simple = streetRaw.match(/^(.+?)\s+(\d+[א-ת]?)\s*$/)
  if (simple) return { city, street: simple[1].trim(), building: simple[2], floor: '', apartment: '' }

  return { city, street: streetRaw, building: '', floor: '', apartment: '' }
}

// ─── Create shipment ──────────────────────────────────────────────────────────

export interface CreateShipmentParams {
  name:       string   // consignee name (P11)
  city:       string   // city (P13)
  street:     string   // street (P15)
  building?:  string   // building no (P16)
  floor?:     string   // floor (P18)
  apartment?: string   // apartment (P19)
  phone:      string   // primary phone (P20)
  email?:     string   // email (P40)
  reference:  string   // your reference, e.g. order ID (P22)
  remarks?:   string   // additional remarks (P25)
}

export interface RunShipment {
  shipNum: string   // ship_create_num — for label & tracking
  randId:  string   // ship_num_rand — for cancellation
}

export async function createShipment(p: CreateShipmentParams): Promise<RunShipment> {
  if (!HOST || !CUSTOMER_NUM) {
    throw new Error('RUN_HOST ו-RUN_CUSTOMER_NUMBER חסרים ב-.env.local')
  }

  // 42 arguments in exact order P1–P42
  const args = [
    n(CUSTOMER_NUM),                        // P1  customer number
    a('מסירה'),                             // P2  delivery type
    n(SHIPMENT_TYPE),                       // P3  shipment type
    n(),                                    // P4  shipment stage
    a('MEZU'),                              // P5  company name
    a(),                                    // P6  blank
    n(CARGO_TYPE),                          // P7  cargo type
    n(), n(), n(),                          // P8-P10 blank
    a(p.name.slice(0, 20)),                 // P11 consignee name
    a(),                                    // P12 city code
    a(p.city.slice(0, 30)),                 // P13 city name
    a(),                                    // P14 street code
    a(p.street.slice(0, 30)),               // P15 street name
    a((p.building || '').slice(0, 5)),      // P16 building no
    a(),                                    // P17 entrance
    a((p.floor || '').slice(0, 2)),         // P18 floor
    a((p.apartment || '').slice(0, 4)),     // P19 apartment
    a(p.phone.replace(/\D/g, '').slice(0, 20)), // P20 phone (digits only)
    a(),                                    // P21 additional phone
    a(p.reference.slice(0, 200)),           // P22 reference number
    n(1),                                   // P23 number of packages
    a(),                                    // P24 address remarks
    a((p.remarks || '').slice(0, 80)),      // P25 additional remarks
    a(), a(), a(),                          // P26-P28 ref2/date/time
    n(), n(), n(),                          // P29-P31 COD
    a(), a(),                               // P32-P33 payment
    n(), n(),                               // P34-P35 pickup points
    a('XML'),                               // P36 response type
    a('N'),                                 // P37 auto pickup point
    a(),                                    // P38 blank
    n(),                                    // P39 blank
    a((p.email || '').slice(0, 100)),       // P40 email
    a(), a(),                               // P41-P42 parcel date/time
  ].join(',')

  const url = runUrl('ship_create_anonymous', args)
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`Run API שגיאה ${res.status}`)

  const xml = await res.text()

  if (xmlTag(xml, 'shgiya_yn') === 'y') {
    throw new Error(xmlTag(xml, 'message') || 'Run API החזיר שגיאה')
  }

  const shipNum = xmlTag(xml, 'ship_create_num')
  const randId  = xmlTag(xml, 'ship_num_rand')

  if (!shipNum) throw new Error('לא התקבל מספר משלוח מ-Run')

  return { shipNum, randId }
}

// ─── Label URL ────────────────────────────────────────────────────────────────

export function buildLabelUrl(shipNum: string): string {
  const args = `-N${shipNum},-A,-A,-A,-A,-A,-A,-N,-A`
  return runUrl('ship_print_ws', args)
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export interface TrackingEvent {
  code: string
  desc: string
  date: string
  time: string
}

export async function getTracking(shipNum: string): Promise<TrackingEvent[]> {
  if (!HOST) throw new Error('RUN_HOST חסר ב-.env.local')

  const args = `-N${shipNum},-A`
  const url  = runUrl('ship_status_xml', args)
  const res  = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`Run tracking שגיאה ${res.status}`)

  const xml    = await res.text()
  const blocks = [...xml.matchAll(/<status>([\s\S]*?)<\/status>/g)]

  return blocks.map(m => ({
    code: xmlTag(m[1], 'status_code'),
    desc: xmlTag(m[1], 'status_desc'),
    date: xmlTag(m[1], 'status_date'),
    time: xmlTag(m[1], 'status_time'),
  })).reverse() // most recent first
}
