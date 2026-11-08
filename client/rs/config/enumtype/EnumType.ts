import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { Type } from "../Type";

/**
 * Changes to the All Settings lists. Each settings category is an enum of setting structs
 * (Activities 4024, Display 424, Interfaces 4025, Popout 4967); these move or copy entries.
 * - "Interface scaling" and its reset (OSRS lists them under Interfaces) are also shown at the
 *   end of Display.
 * - The overlays the client draws are switched from Interfaces > General, after the scaling
 *   reset: "Ground Items Overlay" (from Popout), "Highlight entities on mouse-over" and
 *   "Highlight current / destination tile" (from Activities). OSRS's own settings drive the
 *   client's ground item, hover-highlight and tile-marker plugins (`OverlaySettings.ts`).
 */
const SETTINGS_LIST_EDITS: ReadonlyArray<{ structs: number[]; to: number; after?: number; from?: number[] }> = [
    { structs: [2852, 2853], to: 424 },
    { structs: [4510, 3738, 3646, 3647], to: 4025, after: 2853, from: [4967, 4024] },
];

export class EnumType extends Type {
    inputType!: string;
    outputType!: string;

    defaultString: string;
    defaultInt!: number;

    outputCount: number;

    keys!: number[];

    intValues!: number[];
    stringValues!: string[];

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.defaultString = "null";
        this.outputCount = 0;
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.inputType = String.fromCharCode(buffer.readUnsignedByte());
        } else if (opcode === 2) {
            this.outputType = String.fromCharCode(buffer.readUnsignedByte());
        } else if (opcode === 3) {
            this.defaultString = buffer.readString();
        } else if (opcode === 4) {
            this.defaultInt = buffer.readInt();
        } else if (opcode === 5) {
            this.outputCount = buffer.readUnsignedShort();
            this.keys = new Array(this.outputCount);
            this.stringValues = new Array(this.outputCount);

            for (let i = 0; i < this.outputCount; i++) {
                this.keys[i] = buffer.readInt();
                this.stringValues[i] = buffer.readString();
            }
        } else if (opcode === 6) {
            this.outputCount = buffer.readUnsignedShort();
            this.keys = new Array(this.outputCount);
            this.intValues = new Array(this.outputCount);

            for (let i = 0; i < this.outputCount; i++) {
                this.keys[i] = buffer.readInt();
                this.intValues[i] = buffer.readInt();
            }
        }
    }

    override post(): void {
        if (!this.intValues) return;
        let values = this.intValues;
        let changed = false;
        for (const edit of SETTINGS_LIST_EDITS) {
            if (edit.from?.includes(this.id)) {
                values = values.filter((v) => !edit.structs.includes(v));
                changed = true;
            }
            if (edit.to === this.id) {
                const add = edit.structs.filter((v) => !values.includes(v));
                const at = edit.after !== undefined && values.includes(edit.after) ? values.indexOf(edit.after) + 1 : values.length;
                values = [...values.slice(0, at), ...add, ...values.slice(at)];
                changed = true;
            }
        }
        if (!changed) return;
        // Settings lists are keyed 0..n-1 in order.
        this.intValues = values;
        this.keys = values.map((_, i) => i);
        this.outputCount = values.length;
    }
}
