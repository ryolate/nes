import { uint8 } from './num'

export type Mode = "imm" | "zp" | "zpx" | "zpy" | "izx" | "izy" | "abs" | "abx" | "aby" | "ind" | "rel" | ""
export type Instruction = "ADC" | "AHX" | "ALR" | "ANC" | "AND" | "ARR" | "ASL" | "AXS" | "BCC" | "BCS" | "BEQ" | "BIT" | "BMI" | "BNE" | "BPL" | "BRK" | "BVC" | "BVS" | "CLC" | "CLD" | "CLI" | "CLV" | "CMP" | "CPX" | "CPY" | "DCP" | "DEC" | "DEX" | "DEY" | "EOR" | "INC" | "INX" | "INY" | "ISC" | "JMP" | "JSR" | "KIL" | "LAS" | "LAX" | "LDA" | "LDX" | "LDY" | "LSR" | "NOP" | "ORA" | "PHA" | "PHP" | "PLA" | "PLP" | "RLA" | "ROL" | "ROR" | "RRA" | "RTI" | "RTS" | "SAX" | "SBC" | "SEC" | "SED" | "SEI" | "SHX" | "SHY" | "SLO" | "SRE" | "STA" | "STX" | "STY" | "TAS" | "TAX" | "TAY" | "TSX" | "TXA" | "TXS" | "TYA" | "XAA"

export interface Opcode {
  op: uint8
  opcode: Instruction
  mode: Mode
  cycle: number
  extra: boolean
}

// JSON generated by tools/genops.py
export const opcodes: Array<Opcode> = [
  {
    "op": 0,
    "opcode": "BRK",
    "mode": "",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 1,
    "opcode": "ORA",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 2,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 3,
    "opcode": "SLO",
    "mode": "izx",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 4,
    "opcode": "NOP",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 5,
    "opcode": "ORA",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 6,
    "opcode": "ASL",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 7,
    "opcode": "SLO",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 8,
    "opcode": "PHP",
    "mode": "",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 9,
    "opcode": "ORA",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 10,
    "opcode": "ASL",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 11,
    "opcode": "ANC",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 12,
    "opcode": "NOP",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 13,
    "opcode": "ORA",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 14,
    "opcode": "ASL",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 15,
    "opcode": "SLO",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 16,
    "opcode": "BPL",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 17,
    "opcode": "ORA",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 18,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 19,
    "opcode": "SLO",
    "mode": "izy",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 20,
    "opcode": "NOP",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 21,
    "opcode": "ORA",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 22,
    "opcode": "ASL",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 23,
    "opcode": "SLO",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 24,
    "opcode": "CLC",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 25,
    "opcode": "ORA",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 26,
    "opcode": "NOP",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 27,
    "opcode": "SLO",
    "mode": "aby",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 28,
    "opcode": "NOP",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 29,
    "opcode": "ORA",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 30,
    "opcode": "ASL",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 31,
    "opcode": "SLO",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 32,
    "opcode": "JSR",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 33,
    "opcode": "AND",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 34,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 35,
    "opcode": "RLA",
    "mode": "izx",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 36,
    "opcode": "BIT",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 37,
    "opcode": "AND",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 38,
    "opcode": "ROL",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 39,
    "opcode": "RLA",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 40,
    "opcode": "PLP",
    "mode": "",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 41,
    "opcode": "AND",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 42,
    "opcode": "ROL",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 43,
    "opcode": "ANC",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 44,
    "opcode": "BIT",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 45,
    "opcode": "AND",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 46,
    "opcode": "ROL",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 47,
    "opcode": "RLA",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 48,
    "opcode": "BMI",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 49,
    "opcode": "AND",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 50,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 51,
    "opcode": "RLA",
    "mode": "izy",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 52,
    "opcode": "NOP",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 53,
    "opcode": "AND",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 54,
    "opcode": "ROL",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 55,
    "opcode": "RLA",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 56,
    "opcode": "SEC",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 57,
    "opcode": "AND",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 58,
    "opcode": "NOP",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 59,
    "opcode": "RLA",
    "mode": "aby",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 60,
    "opcode": "NOP",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 61,
    "opcode": "AND",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 62,
    "opcode": "ROL",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 63,
    "opcode": "RLA",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 64,
    "opcode": "RTI",
    "mode": "",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 65,
    "opcode": "EOR",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 66,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 67,
    "opcode": "SRE",
    "mode": "izx",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 68,
    "opcode": "NOP",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 69,
    "opcode": "EOR",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 70,
    "opcode": "LSR",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 71,
    "opcode": "SRE",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 72,
    "opcode": "PHA",
    "mode": "",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 73,
    "opcode": "EOR",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 74,
    "opcode": "LSR",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 75,
    "opcode": "ALR",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 76,
    "opcode": "JMP",
    "mode": "abs",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 77,
    "opcode": "EOR",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 78,
    "opcode": "LSR",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 79,
    "opcode": "SRE",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 80,
    "opcode": "BVC",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 81,
    "opcode": "EOR",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 82,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 83,
    "opcode": "SRE",
    "mode": "izy",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 84,
    "opcode": "NOP",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 85,
    "opcode": "EOR",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 86,
    "opcode": "LSR",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 87,
    "opcode": "SRE",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 88,
    "opcode": "CLI",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 89,
    "opcode": "EOR",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 90,
    "opcode": "NOP",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 91,
    "opcode": "SRE",
    "mode": "aby",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 92,
    "opcode": "NOP",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 93,
    "opcode": "EOR",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 94,
    "opcode": "LSR",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 95,
    "opcode": "SRE",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 96,
    "opcode": "RTS",
    "mode": "",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 97,
    "opcode": "ADC",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 98,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 99,
    "opcode": "RRA",
    "mode": "izx",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 100,
    "opcode": "NOP",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 101,
    "opcode": "ADC",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 102,
    "opcode": "ROR",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 103,
    "opcode": "RRA",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 104,
    "opcode": "PLA",
    "mode": "",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 105,
    "opcode": "ADC",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 106,
    "opcode": "ROR",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 107,
    "opcode": "ARR",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 108,
    "opcode": "JMP",
    "mode": "ind",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 109,
    "opcode": "ADC",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 110,
    "opcode": "ROR",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 111,
    "opcode": "RRA",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 112,
    "opcode": "BVS",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 113,
    "opcode": "ADC",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 114,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 115,
    "opcode": "RRA",
    "mode": "izy",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 116,
    "opcode": "NOP",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 117,
    "opcode": "ADC",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 118,
    "opcode": "ROR",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 119,
    "opcode": "RRA",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 120,
    "opcode": "SEI",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 121,
    "opcode": "ADC",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 122,
    "opcode": "NOP",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 123,
    "opcode": "RRA",
    "mode": "aby",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 124,
    "opcode": "NOP",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 125,
    "opcode": "ADC",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 126,
    "opcode": "ROR",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 127,
    "opcode": "RRA",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 128,
    "opcode": "NOP",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 129,
    "opcode": "STA",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 130,
    "opcode": "NOP",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 131,
    "opcode": "SAX",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 132,
    "opcode": "STY",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 133,
    "opcode": "STA",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 134,
    "opcode": "STX",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 135,
    "opcode": "SAX",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 136,
    "opcode": "DEY",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 137,
    "opcode": "NOP",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 138,
    "opcode": "TXA",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 139,
    "opcode": "XAA",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 140,
    "opcode": "STY",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 141,
    "opcode": "STA",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 142,
    "opcode": "STX",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 143,
    "opcode": "SAX",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 144,
    "opcode": "BCC",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 145,
    "opcode": "STA",
    "mode": "izy",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 146,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 147,
    "opcode": "AHX",
    "mode": "izy",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 148,
    "opcode": "STY",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 149,
    "opcode": "STA",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 150,
    "opcode": "STX",
    "mode": "zpy",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 151,
    "opcode": "SAX",
    "mode": "zpy",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 152,
    "opcode": "TYA",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 153,
    "opcode": "STA",
    "mode": "aby",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 154,
    "opcode": "TXS",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 155,
    "opcode": "TAS",
    "mode": "aby",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 156,
    "opcode": "SHY",
    "mode": "abx",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 157,
    "opcode": "STA",
    "mode": "abx",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 158,
    "opcode": "SHX",
    "mode": "aby",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 159,
    "opcode": "AHX",
    "mode": "aby",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 160,
    "opcode": "LDY",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 161,
    "opcode": "LDA",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 162,
    "opcode": "LDX",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 163,
    "opcode": "LAX",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 164,
    "opcode": "LDY",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 165,
    "opcode": "LDA",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 166,
    "opcode": "LDX",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 167,
    "opcode": "LAX",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 168,
    "opcode": "TAY",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 169,
    "opcode": "LDA",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 170,
    "opcode": "TAX",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 171,
    "opcode": "LAX",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 172,
    "opcode": "LDY",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 173,
    "opcode": "LDA",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 174,
    "opcode": "LDX",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 175,
    "opcode": "LAX",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 176,
    "opcode": "BCS",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 177,
    "opcode": "LDA",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 178,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 179,
    "opcode": "LAX",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 180,
    "opcode": "LDY",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 181,
    "opcode": "LDA",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 182,
    "opcode": "LDX",
    "mode": "zpy",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 183,
    "opcode": "LAX",
    "mode": "zpy",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 184,
    "opcode": "CLV",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 185,
    "opcode": "LDA",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 186,
    "opcode": "TSX",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 187,
    "opcode": "LAS",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 188,
    "opcode": "LDY",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 189,
    "opcode": "LDA",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 190,
    "opcode": "LDX",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 191,
    "opcode": "LAX",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 192,
    "opcode": "CPY",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 193,
    "opcode": "CMP",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 194,
    "opcode": "NOP",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 195,
    "opcode": "DCP",
    "mode": "izx",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 196,
    "opcode": "CPY",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 197,
    "opcode": "CMP",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 198,
    "opcode": "DEC",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 199,
    "opcode": "DCP",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 200,
    "opcode": "INY",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 201,
    "opcode": "CMP",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 202,
    "opcode": "DEX",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 203,
    "opcode": "AXS",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 204,
    "opcode": "CPY",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 205,
    "opcode": "CMP",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 206,
    "opcode": "DEC",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 207,
    "opcode": "DCP",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 208,
    "opcode": "BNE",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 209,
    "opcode": "CMP",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 210,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 211,
    "opcode": "DCP",
    "mode": "izy",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 212,
    "opcode": "NOP",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 213,
    "opcode": "CMP",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 214,
    "opcode": "DEC",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 215,
    "opcode": "DCP",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 216,
    "opcode": "CLD",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 217,
    "opcode": "CMP",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 218,
    "opcode": "NOP",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 219,
    "opcode": "DCP",
    "mode": "aby",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 220,
    "opcode": "NOP",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 221,
    "opcode": "CMP",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 222,
    "opcode": "DEC",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 223,
    "opcode": "DCP",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 224,
    "opcode": "CPX",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 225,
    "opcode": "SBC",
    "mode": "izx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 226,
    "opcode": "NOP",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 227,
    "opcode": "ISC",
    "mode": "izx",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 228,
    "opcode": "CPX",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 229,
    "opcode": "SBC",
    "mode": "zp",
    "cycle": 3,
    "extra": false
  },
  {
    "op": 230,
    "opcode": "INC",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 231,
    "opcode": "ISC",
    "mode": "zp",
    "cycle": 5,
    "extra": false
  },
  {
    "op": 232,
    "opcode": "INX",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 233,
    "opcode": "SBC",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 234,
    "opcode": "NOP",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 235,
    "opcode": "SBC",
    "mode": "imm",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 236,
    "opcode": "CPX",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 237,
    "opcode": "SBC",
    "mode": "abs",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 238,
    "opcode": "INC",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 239,
    "opcode": "ISC",
    "mode": "abs",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 240,
    "opcode": "BEQ",
    "mode": "rel",
    "cycle": 2,
    "extra": true
  },
  {
    "op": 241,
    "opcode": "SBC",
    "mode": "izy",
    "cycle": 5,
    "extra": true
  },
  {
    "op": 242,
    "opcode": "KIL",
    "mode": "",
    "cycle": 0,
    "extra": false
  },
  {
    "op": 243,
    "opcode": "ISC",
    "mode": "izy",
    "cycle": 8,
    "extra": false
  },
  {
    "op": 244,
    "opcode": "NOP",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 245,
    "opcode": "SBC",
    "mode": "zpx",
    "cycle": 4,
    "extra": false
  },
  {
    "op": 246,
    "opcode": "INC",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 247,
    "opcode": "ISC",
    "mode": "zpx",
    "cycle": 6,
    "extra": false
  },
  {
    "op": 248,
    "opcode": "SED",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 249,
    "opcode": "SBC",
    "mode": "aby",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 250,
    "opcode": "NOP",
    "mode": "",
    "cycle": 2,
    "extra": false
  },
  {
    "op": 251,
    "opcode": "ISC",
    "mode": "aby",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 252,
    "opcode": "NOP",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 253,
    "opcode": "SBC",
    "mode": "abx",
    "cycle": 4,
    "extra": true
  },
  {
    "op": 254,
    "opcode": "INC",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  },
  {
    "op": 255,
    "opcode": "ISC",
    "mode": "abx",
    "cycle": 7,
    "extra": false
  }
]
