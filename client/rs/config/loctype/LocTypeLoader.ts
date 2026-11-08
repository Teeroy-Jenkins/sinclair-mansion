import { Archive } from "../../cache/Archive";
import { CacheIndex } from "../../cache/CacheIndex";
import { CacheInfo } from "../../cache/CacheInfo";
import {
    ArchiveTypeLoader,
    IndexTypeLoader,
    IndexedDatTypeLoader,
    TypeLoader,
} from "../TypeLoader";
import { LocType } from "./LocType";
import { VIRTUAL_LOCS } from "./VirtualLocs";

export type LocTypeLoader = TypeLoader<LocType>;

/** Decode a virtual loc (see VirtualLocs.ts) from its base loc's data. */
function loadVirtualLoc(
    id: number,
    cacheInfo: CacheInfo,
    getDataBuffer: (id: number) => ReturnType<ArchiveTypeLoader<LocType>["getDataBuffer"]>,
): LocType | undefined {
    const v = VIRTUAL_LOCS.get(id);
    if (!v) return undefined;
    const type = new LocType(id, cacheInfo);
    const buffer = getDataBuffer(v.base);
    if (buffer) {
        type.decode(buffer);
        type.post();
    }
    if (v.mirror) type.isRotated = !type.isRotated;
    return type;
}

export class DatLocTypeLoader {
    static load(cacheInfo: CacheInfo, configArchive: Archive): LocTypeLoader {
        return IndexedDatTypeLoader.load(LocType, cacheInfo, configArchive, "loc");
    }
}

export class ArchiveLocTypeLoader extends ArchiveTypeLoader<LocType> implements LocTypeLoader {
    constructor(cacheInfo: CacheInfo, archive: Archive) {
        super(LocType, cacheInfo, archive);
    }

    override load(id: number): LocType {
        if (!VIRTUAL_LOCS.has(id)) return super.load(id);
        const cached = this.cache.get(id);
        if (cached) return cached;
        const type = loadVirtualLoc(id, this.cacheInfo, (base) => this.getDataBuffer(base))!;
        this.cache.set(id, type);
        return type;
    }
}

export class IndexLocTypeLoader extends IndexTypeLoader<LocType> implements LocTypeLoader {
    constructor(cacheInfo: CacheInfo, index: CacheIndex) {
        super(LocType, cacheInfo, index);
    }

    override load(id: number): LocType {
        if (!VIRTUAL_LOCS.has(id)) return super.load(id);
        const cached = this.cache.get(id);
        if (cached) return cached;
        const type = loadVirtualLoc(id, this.cacheInfo, (base) => this.getDataBuffer(base))!;
        this.cache.set(id, type);
        return type;
    }
}
