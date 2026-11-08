import type { WeaponCombatProfile } from "../WeaponCombatProfile";
import { ARMADYL_GODSWORD_PROFILE } from "./ArmadylGodswordSpec";
import { ABYSSAL_TENTACLE_PROFILE } from "./AbyssalTentacleSpec";
import { DARK_BOW_PROFILE } from "./DarkBowSpec";
import { DRAGON_CLAWS_PROFILE } from "./DragonClawsSpec";
import { DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE } from "./DragonDaggerSpecialAttack";
import { DRAGON_HALBERD_PROFILE } from "./DragonHalberdSpec";
import { DRAGON_KNIFE_PROFILE } from "./DragonKnifeSpec";
import { DRAGON_SPEAR_PROFILE } from "./DragonSpearSpec";
import { GRANITE_MAUL_SPECIAL_ATTACK_PROFILES } from "./GraniteMaulSpecialAttack";
import { HEAVY_BALLISTA_PROFILE } from "./HeavyBallistaSpec";
import { LIGHT_BALLISTA_PROFILE } from "./LightBallistaSpec";
import { MAGIC_COMP_BOW_PROFILE, MAGIC_LONGBOW_PROFILE } from "./MagicLongbowSpec";
import { MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES } from "./MagicShortbowSpecialAttack";
import { NOXIOUS_HALBERD_PROFILE } from "./NoxiousHalberdSpec";
import { OSMUMTENS_FANG_PROFILE } from "./OsmumtensFangSpec";
import { ROSEWOOD_BLOWPIPE_PROFILE } from "./RosewoodBlowpipeSpec";
import { RUNE_CLAWS_PROFILE } from "./RuneClawsSpec";
import { SARADOMIN_GODSWORD_PROFILE } from "./SaradominGodswordSpec";
import { SARADOMIN_SWORD_PROFILE } from "./SaradominSwordSpec";
import { SARADOMINS_BLESSED_SWORD_PROFILE } from "./SaradominsBlessedSwordSpec";
import { TOXIC_BLOWPIPE_PROFILE } from "./ToxicBlowpipeSpec";
import { VESTAS_SPEAR_BH_PROFILE } from "./VestasSpearBhSpec";
import { WEBWEAVER_BOW_PROFILE } from "./WebweaverBowSpec";

export { ANCIENT_GODSWORD_SPEC, AncientGodswordSpec } from "./AncientGodswordSpec";
export { ANCIENT_MACE_SPEC, AncientMaceSpec } from "./AncientMaceSpec";
export { ABYSSAL_WHIP_SPEC, AbyssalWhipSpec } from "./AbyssalWhipSpec";
export {
    ABYSSAL_TENTACLE_PROFILE,
    ABYSSAL_TENTACLE_SPEC,
    AbyssalTentacleSpec,
    applyBindingTentacleEffects,
} from "./AbyssalTentacleSpec";
export { ABYSSAL_DAGGER_SPEC, ABYSSAL_DAGGER_SPECS, AbyssalDaggerSpec } from "./AbyssalDaggerSpec";
export { ABYSSAL_BLUDGEON_SPEC, AbyssalBludgeonSpec } from "./AbyssalBludgeonSpec";
export { ACCURSED_SCEPTRE_SPEC, AccursedSceptreSpec } from "./AccursedSceptreSpec";
export { ARCLIGHT_SPEC, ArclightSpec } from "./ArclightSpec";
export { ARKAN_BLADE_BURN_PROFILE_ID, ARKAN_BLADE_SPEC, ArkanBladeSpec } from "./ArkanBladeSpec";
export { ARMADYL_CROSSBOW_SPEC, ArmadylCrossbowSpec } from "./ArmadylCrossbowSpec";
export {
    ARMADYL_GODSWORD_PROFILE,
    ARMADYL_GODSWORD_SPEC,
    ARMADYL_GODSWORD_SPECS,
    ArmadylGodswordSpec,
} from "./ArmadylGodswordSpec";
export { BANDOS_GODSWORD_SPEC, BandosGodswordSpec } from "./BandosGodswordSpec";
export {
    BLUE_MOON_SPEAR_SPEC,
    BLUE_MOON_SPEAR_SPECS,
    BlueMoonSpearSpec,
} from "./BlueMoonSpearSpec";
export { BARRELCHEST_ANCHOR_SPEC, BarrelchestAnchorSpec } from "./BarrelchestAnchorSpec";
export { BONE_DAGGER_SPEC, BONE_DAGGER_VARIANT_SPECS, BoneDaggerSpec } from "./BoneDaggerSpec";
export { BRINE_SABRE_SPEC, BrineSabreSpec } from "./BrineSabreSpec";
export { BURNING_CLAWS_SPEC, BurningClawsSpec } from "./BurningClawsSpec";
export { CRIMSON_KISTEN_SPEC, CrimsonKistenSpec } from "./CrimsonKistenSpec";
export { DARKLIGHT_SPEC, DarklightSpec } from "./DarklightSpec";
export {
    DARK_BOW_PROFILE,
    DARK_BOW_SPEC,
    DARK_BOW_SPECS,
    DarkBowSpec,
    isDragonArrow,
    resolveDarkBowSpecialConfiguration,
} from "./DarkBowSpec";
export { DAWNBRINGER_SPEC, DawnbringerSpec } from "./DawnbringerSpec";
export { DORGESHUUN_CROSSBOW_SPEC, DorgeshuunCrossbowSpec } from "./DorgeshuunCrossbowSpec";
export { DINHS_BULWARK_SPEC, DinhsBulwarkSpec } from "./DinhsBulwarkSpec";
export {
    DUAL_MACUAHUITL_SPEC,
    DUAL_MACUAHUITL_SPECS,
    DualMacuahuitlSpec,
} from "./DualMacuahuitlSpec";
export {
    ELDRITCH_NIGHTMARE_STAFF_SPEC,
    EldritchNightmareStaffSpec,
} from "./EldritchNightmareStaffSpec";
export {
    VOLATILE_NIGHTMARE_STAFF_SPEC,
    VOLATILE_NIGHTMARE_STAFF_SPECS,
    VolatileNightmareStaffSpec,
} from "./VolatileNightmareStaffSpec";
export { ECLIPSE_ATLATL_SPEC, ECLIPSE_ATLATL_SPECS, EclipseAtlatlSpec } from "./EclipseAtlatlSpec";
export {
    ELDER_MAUL_ORNAMENTED_SPEC,
    ELDER_MAUL_SPEC,
    ELDER_MAUL_SPECS,
    ElderMaulSpec,
} from "./ElderMaulSpec";
export { EYE_OF_AYAK_SPEC, EyeOfAyakSpec } from "./EyeOfAyakSpec";
export { EMBERLIGHT_SPEC, EmberlightSpec } from "./EmberlightSpec";
export { EXCALIBUR_SPEC, ExcaliburSpec } from "./ExcaliburSpec";
export {
    DRAGON_DAGGER_SPECIAL_ATTACK_SCRIPTS,
    DragonDaggerSpecialAttackScript,
} from "./DragonDaggerSpecialAttack";
export { DRAGON_WARHAMMER_SPEC, DragonWarhammerSpec } from "./DragonWarhammerSpec";
export { DRAGON_AXE_SPEC, DRAGON_AXE_VARIANT_SPECS, DragonAxeSpec } from "./DragonAxeSpec";
export { DRAGON_BATTLEAXE_SPEC, DragonBattleaxeSpec } from "./DragonBattleaxeSpec";
export { DRAGON_CROSSBOW_SPEC, DragonCrossbowSpec } from "./DragonCrossbowSpec";
export {
    DRAGON_CLAWS_ALL_MISS_PATTERNS,
    DRAGON_CLAWS_PROFILE,
    DRAGON_CLAWS_SPEC,
    DRAGON_CLAWS_SPECS,
    DragonClawsSpec,
    calculateDragonClawsHitDistribution,
} from "./DragonClawsSpec";
export { DRAGON_LONGSWORD_SPEC, DragonLongswordSpec } from "./DragonLongswordSpec";
export {
    DRAGON_KNIFE_PROFILE,
    DRAGON_KNIFE_SPEC,
    DRAGON_KNIFE_SPECS,
    DragonKnifeSpec,
} from "./DragonKnifeSpec";
export { DRAGON_MACE_SPEC, DragonMaceSpec } from "./DragonMaceSpec";
export { DRAGON_SWORD_SPEC, DragonSwordSpec } from "./DragonSwordSpec";
export {
    DRAGON_SPEAR_ITEM_IDS,
    DRAGON_SPEAR_PROFILE,
    DRAGON_SPEAR_SPEC,
    DRAGON_SPEAR_SPECS,
    DragonSpearSpec,
    applyDragonSpearShove,
} from "./DragonSpearSpec";
export { DRAGON_THROWNAXE_SPEC, DragonThrownaxeSpec } from "./DragonThrownaxeSpec";
export { DRAGON_SCIMITAR_SPEC, DragonScimitarSpec } from "./DragonScimitarSpec";
export {
    CRYSTAL_HALBERD_SPEC,
    DRAGON_HALBERD_PROFILE,
    DRAGON_HALBERD_SPEC,
    HALBERD_SWEEP_TARGETING,
    DragonHalberdSpec,
} from "./DragonHalberdSpec";
export { DRAGON_HASTA_SPEC, DRAGON_HASTA_SPECS, DragonHastaSpec } from "./DragonHastaSpec";
export { DRAGON_2H_SWORD_SPEC, Dragon2hSwordSpec } from "./Dragon2hSwordSpec";
export {
    DRAGON_HARPOON_SPEC,
    DRAGON_HARPOON_VARIANT_SPECS,
    DragonHarpoonSpec,
} from "./DragonHarpoonSpec";
export {
    DRAGON_PICKAXE_SPEC,
    DRAGON_PICKAXE_VARIANT_SPECS,
    DragonPickaxeSpec,
} from "./DragonPickaxeSpec";
export {
    GRANITE_MAUL_ITEM_IDS,
    GRANITE_MAUL_ORNATE_ENERGY_COST,
    GRANITE_MAUL_SPECIAL_ATTACK_PROFILE,
    GRANITE_MAUL_SPECIAL_ATTACK_PROFILES,
    GRANITE_MAUL_SPECIAL_ATTACK_SCRIPTS,
    GRANITE_MAUL_STANDARD_ENERGY_COST,
    ORNATE_GRANITE_MAUL_ITEM_ID,
    ORNATE_GRANITE_MAUL_SPECIAL_ATTACK_PROFILE,
    GraniteMaulSpecialAttackScript,
    getGraniteMaulSpecialAttackEnergyCost,
    isGraniteMaul,
    queueGraniteMaulSpecialAttackInput,
} from "./GraniteMaulSpecialAttack";
export { GRANITE_HAMMER_SPEC, GraniteHammerSpec } from "./GraniteHammerSpec";
export {
    HEAVY_BALLISTA_PROFILE,
    HEAVY_BALLISTA_SPEC,
    HEAVY_BALLISTA_SPECS,
    HeavyBallistaSpec,
} from "./HeavyBallistaSpec";
export {
    LIGHT_BALLISTA_PROFILE,
    LIGHT_BALLISTA_SPEC,
    LIGHT_BALLISTA_SPECS,
    LightBallistaSpec,
} from "./LightBallistaSpec";
export {
    MAGIC_SHORTBOW_SPECIAL_ATTACK_SCRIPTS,
    MagicShortbowSpecialAttackScript,
} from "./MagicShortbowSpecialAttack";
export {
    MAGIC_COMP_BOW_PROFILE,
    MAGIC_COMP_BOW_SPEC,
    MAGIC_LONGBOW_PROFILE,
    MAGIC_LONGBOW_SPEC,
    MAGIC_LONGBOW_SPECS,
    MagicLongbowSpec,
} from "./MagicLongbowSpec";
export {
    MORRIGANS_THROWING_AXE_BH_SPEC,
    MorrigansThrowingAxeBhSpec,
} from "./MorrigansThrowingAxeBhSpec";
export {
    MORRIGANS_JAVELIN_BLEED_PROFILE_ID,
    MORRIGANS_JAVELIN_SPEC,
    MORRIGANS_JAVELIN_SPECS,
    MorrigansJavelinSpec,
} from "./MorrigansJavelinSpec";
export {
    NOXIOUS_HALBERD_PROFILE,
    NOXIOUS_HALBERD_SPEC,
    NoxiousHalberdSpec,
} from "./NoxiousHalberdSpec";
export {
    OSMUMTENS_FANG_PROFILE,
    OSMUMTENS_FANG_SPEC,
    OSMUMTENS_FANG_SPECS,
    OsmumtensFangSpec,
} from "./OsmumtensFangSpec";
export { VOIDWAKER_SPEC, VoidwakerSpec } from "./VoidwakerSpec";
export {
    TOXIC_BLOWPIPE_PROFILE,
    TOXIC_BLOWPIPE_SPEC,
    ToxicBlowpipeSpec,
} from "./ToxicBlowpipeSpec";
export { TOXIC_STAFF_OF_THE_DEAD_SPEC, ToxicStaffOfTheDeadSpec } from "./ToxicStaffOfTheDeadSpec";
export { TONALZTICS_OF_RALOS_SPEC, TonalzticsOfRalosSpec } from "./TonalzticsOfRalosSpec";
export { PURGING_STAFF_SPEC, PurgingStaffSpec } from "./PurgingStaffSpec";
export { RUNE_THROWNAXE_SPEC, RuneThrownaxeSpec } from "./RuneThrownaxeSpec";
export {
    ROSEWOOD_BLOWPIPE_PROFILE,
    ROSEWOOD_BLOWPIPE_SPEC,
    RosewoodBlowpipeSpec,
} from "./RosewoodBlowpipeSpec";
export { RUNE_CLAWS_PROFILE, RUNE_CLAWS_SPEC, RuneClawsSpec } from "./RuneClawsSpec";
export {
    SARADOMINS_BLESSED_SWORD_PROFILE,
    SARADOMINS_BLESSED_SWORD_SPEC,
    SaradominsBlessedSwordSpec,
} from "./SaradominsBlessedSwordSpec";
export { SOULFLAME_HORN_SPEC, SoulflameHornSpec } from "./SoulflameHornSpec";
export { SUNSPEAR_SPEC, SunspearSpec } from "./SunspearSpec";
export { VESTAS_SPEAR_DEADMAN_SPEC, VestasSpearDeadmanSpec } from "./VestasSpearDeadmanSpec";
export {
    VESTAS_SPEAR_BH_PROFILE,
    VESTAS_SPEAR_BH_SPEC,
    VestasSpearBhSpec,
} from "./VestasSpearBhSpec";
export {
    WEBWEAVER_BOW_ACTIVATION_ETHER,
    WEBWEAVER_BOW_ITEM_ID,
    WEBWEAVER_BOW_MAX_AMMO_ETHER,
    WEBWEAVER_BOW_PROFILE,
    WEBWEAVER_BOW_REVENANT_ETHER_ITEM_ID,
    WEBWEAVER_BOW_SPEC,
    WEBWEAVER_BOW_UNCHARGED_ITEM_ID,
    WebweaverBowSpec,
    calculateWebweaverSwarmMaxHit,
    consumeWebweaverEtherCharge,
    getWebweaverEtherCharges,
    hasWebweaverWildernessPassive,
    shouldApplyWebweaverPoison,
} from "./WebweaverBowSpec";
export {
    ZARYTE_CROSSBOW_SPEC,
    ZARYTE_CROSSBOW_SPECS,
    ZaryteCrossbowSpec,
} from "./ZaryteCrossbowSpec";
export {
    VESTAS_LONGSWORD_BH_SPEC,
    VESTAS_LONGSWORD_BH_SPECS,
    VestasLongswordBhSpec,
} from "./VestasLongswordBhSpec";
export {
    SARADOMIN_GODSWORD_PROFILE,
    SARADOMIN_GODSWORD_SPECS,
    SaradominGodswordSpec,
} from "./SaradominGodswordSpec";
export {
    SARADOMIN_SWORD_PROFILE,
    SARADOMIN_SWORD_SPEC,
    SaradominSwordSpec,
} from "./SaradominSwordSpec";
export { SEERCULL_SPEC, SeercullSpec } from "./SeercullSpec";
export { STATIUS_WARHAMMER_BH_SPEC, StatiusWarhammerBhSpec } from "./StatiusWarhammerBhSpec";
export { STAFF_OF_THE_DEAD_SPEC, StaffOfTheDeadSpec } from "./StaffOfTheDeadSpec";
export { STAFF_OF_LIGHT_SPEC, StaffOfLightSpec } from "./StaffOfLightSpec";
export { STAFF_OF_BALANCE_SPEC, StaffOfBalanceSpec } from "./StaffOfBalanceSpec";
export {
    KERIS_PARTISAN_OF_THE_SUN_SPEC,
    KerisPartisanOfTheSunSpec,
} from "./KerisPartisanOfTheSunSpec";
export {
    KERIS_PARTISAN_OF_CORRUPTION_SPEC,
    KerisPartisanOfCorruptionSpec,
} from "./KerisPartisanOfCorruptionSpec";

export const CORE_SPECIAL_ATTACK_PROFILES: readonly WeaponCombatProfile[] = Object.freeze([
    ABYSSAL_TENTACLE_PROFILE,
    DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE,
    ...GRANITE_MAUL_SPECIAL_ATTACK_PROFILES,
    ...MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES,
    MAGIC_LONGBOW_PROFILE,
    MAGIC_COMP_BOW_PROFILE,
    TOXIC_BLOWPIPE_PROFILE,
    SARADOMIN_GODSWORD_PROFILE,
    ARMADYL_GODSWORD_PROFILE,
    HEAVY_BALLISTA_PROFILE,
    LIGHT_BALLISTA_PROFILE,
    NOXIOUS_HALBERD_PROFILE,
    OSMUMTENS_FANG_PROFILE,
    RUNE_CLAWS_PROFILE,
    SARADOMINS_BLESSED_SWORD_PROFILE,
    DARK_BOW_PROFILE,
    DRAGON_CLAWS_PROFILE,
    DRAGON_HALBERD_PROFILE,
    DRAGON_KNIFE_PROFILE,
    DRAGON_SPEAR_PROFILE,
    ROSEWOOD_BLOWPIPE_PROFILE,
    SARADOMIN_SWORD_PROFILE,
    VESTAS_SPEAR_BH_PROFILE,
    WEBWEAVER_BOW_PROFILE,
]);

export {
    DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE,
    MAGIC_SHORTBOW_SPECIAL_ATTACK_PROFILES,
};
