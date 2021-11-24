/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
import { ITelemetryBaseLogger, ITelemetryLogger } from "@fluidframework/common-definitions";
import { Lazy } from "@fluidframework/common-utils";
import { DebugLogger } from "./debugLogger";
import { ChildLogger, ITelemetryLoggerPropertyBags } from "./logger";

export type SettingType = string | boolean | number | (string | boolean | number)[] | null;

export interface ProvideSettingsProvider {
    readonly SettingsProvider: SettingsProvider;
}

/**
 * Return settings in order to enable/disable/control features.
 */
export interface SettingsProvider extends ProvideSettingsProvider {
    /**
     * Used to get the setting value for the specified setting.
     * Providing a default in case setting is not available or not defined.
     */
    getSetting<T extends SettingType>(settingName: string, defaultValue: T, namespace?: string): T;
}

/**
 * @alpha
 */
export interface IConfigProviderBase {
    getRawConfig(name: string): string | undefined;
}

/**
 * @alpha
 */
export interface TypeConverters {
    number: TypeConverter<number>;
    string: TypeConverter<string>;
    boolean: TypeConverter<boolean>;
    numberArray: TypeConverter<number[]>
    stringArray: TypeConverter<string[]>
    booleanArray: TypeConverter<boolean[]>
    never: TypeConverter<never>
}

/**
 * @alpha
 */
export type TypeConverter<T> = (v: string | undefined) => T | undefined;

/**
 * @alpha
 */
export type TypeConverterNames = keyof TypeConverters;

/**
 * @alpha
 */
export interface IConfigProvider extends IConfigProviderBase {
    getConfig<T extends TypeConverterNames>(
        name: string, converter: T,
    ): ReturnType<TypeConverters[T]> | undefined;
}

const converters: TypeConverters = {
    number: (v) => v === undefined ? undefined : Number.parseFloat(v),
    string: (v) => v,
    boolean: (v) => {
        switch (v?.trim().toLocaleLowerCase()) {
            case "true": case "1": return true;
            case "false": case "0": return false;
            default: return undefined;
        }
    },
    numberArray: (v) => parseArray(v, (e): e is number => typeof e === "number"),
    stringArray: (v) => parseArray(v, (e): e is string => typeof e === "string"),
    booleanArray: (v) => parseArray(v, (e): e is boolean => typeof e === "boolean"),
    never: () => undefined,
};

function parseArray<T>(v: string | undefined, is: (e: unknown) => e is T) {
    if (v !== undefined) {
        try {
            const p = JSON.parse(v);
            if (Array.isArray(p) && !p.includes((e) => !is(e))) {
                return p as T[];
            }
        } catch { }
    }
    return undefined;
}

type ReturnToProp<T> = { [P in keyof T]?: T[P] extends (...args: any) => any ? ReturnType<T[P]> : never };

interface ConfigCacheEntry extends ReturnToProp<TypeConverters> {
    readonly raw: string | undefined;
    readonly name: string;
}
const sessionStorageProvider = new Lazy(() => {
    if (sessionStorage !== undefined && sessionStorage !== null && typeof sessionStorage === "object") {
        return {
            getRawConfig: (name: string) => {
                try {
                    return sessionStorage.getItem(name) ?? undefined;
                } catch { }
                return undefined;
            },
        };
    }
});

export const tryCreateSessionStorageConfigProvider = () => sessionStorageProvider.value;

export class ConfigProvider implements IConfigProvider {
    private readonly configCache = new Map<string, ConfigCacheEntry>();
    private readonly orderedProviders: (IConfigProvider)[];
    private readonly namespace: string | undefined;
    private static readonly logger = DebugLogger.create("fluid:telemetry:configProvider");

    constructor(
        orderedProviders: (IConfigProviderBase | ITelemetryBaseLogger)[],
        namespace: string | undefined,
    ) {
        this.orderedProviders = [];
        const knownProviders = new Set<IConfigProviderBase>();
        const candidateProviders = [...orderedProviders];

        while (candidateProviders.length > 0) {
            const baseProvider = candidateProviders.shift()!;
            if (baseProvider !== undefined
                && isConfigProviderBase(baseProvider)
                && !knownProviders.has(baseProvider)
            ) {
                knownProviders.add(baseProvider);
                if (baseProvider instanceof ConfigProvider) {
                    // we build up the namespace. so take the namespace of the highest
                    // base provider, and append ours below if specified
                    if (this.namespace === undefined) {
                        this.namespace = baseProvider.namespace;
                    }
                    candidateProviders.push(...baseProvider.orderedBaseProviders);
                } else {
                    this.orderedBaseProviders.push(baseProvider);
                }
            }
        }

        if (namespace !== undefined) {
            this.namespace = this.namespace === undefined ? namespace : `${this.namespace}.${namespace}`;
        }
    }

    getRawConfig(name: string): string | undefined {
        return this.getCacheEntry(name)?.raw;
    }

    public getConfig<T extends TypeConverterNames>(
        name: string, converter: T,
    ): ReturnType<TypeConverters[T]> | undefined {
        const cacheValue = this.getCacheEntry(name);

        if (cacheValue?.raw === undefined) {
            ConfigProvider.logger.sendTelemetryEvent({ eventName: "ConfigValueNotSet", name: cacheValue?.name });
            return undefined;
        }

        if (converter in cacheValue) {
            return cacheValue[converter] as ReturnType<TypeConverters[T]>;
        }

        const value: any = converters[converter]?.(cacheValue.raw);

        if (value !== undefined) {
            cacheValue[converter] = value;
            return value as ReturnType<TypeConverters[T]>;
        }
        ConfigProvider.logger.sendErrorEvent({
            eventName: "ConfigValueNotConvertible",
            name: cacheValue?.name,
            value: cacheValue.raw,
            converter,
        });
        return undefined;
    }

    private getCacheEntry(name: string): ConfigCacheEntry | undefined {
        const nname = this.namespace ? `${this.namespace}.${name}` : name;
        if (!this.configCache.has(nname)) {
            for (const provider of this.orderedBaseProviders) {
                const str = provider?.getRawConfig(nname);
                if (str !== undefined) {
                    const entry: ConfigCacheEntry = {
                        raw: str,
                        name,
                    };
                    this.configCache.set(nname, entry);
                    return entry;
                }
            }
            // configs are immutable, if the first lookup returned no results, all lookups should
            this.configCache.set(nname, { raw: undefined, name: nname });
        }
        return this.configCache.get(nname);
    }
}

/**
 * @alpha
 */
export type ITelemetryLoggerWithConfig = ITelemetryLogger & IConfigProvider;

/**
 * @alpha
 */
export function mixinChildLoggerWithConfigProvider(
    logger: ITelemetryLogger,
    namespace?: string,
    properties?: ITelemetryLoggerPropertyBags,
): ITelemetryLoggerWithConfig {
    const config = new ConfigProvider([sessionStorageProvider.value, logger], namespace);
    const mixin: ITelemetryLogger & Partial<IConfigProvider> = ChildLogger.create(logger, namespace, properties);
    mixin.getConfig = config.getConfig.bind(config);
    mixin.getRawConfig = config.getRawConfig.bind(config);
    return mixin as ITelemetryLoggerWithConfig;
}

export function mixinConfigProvider(
    logger: ITelemetryLogger,
    config: IConfigProvider,
): ITelemetryLoggerWithConfig {
    if (isConfigProviderBase(logger)) {
        throw new Error("Logger Is already config provider");
    }
    const mixin: ITelemetryLogger & Partial<IConfigProvider> = logger;
    mixin.getConfig = config.getConfig.bind(config);
    mixin.getRawConfig = config.getRawConfig.bind(config);
    return mixin as ITelemetryLoggerWithConfig;
}

function isConfigProviderBase<T>(obj: T): obj is T & IConfigProviderBase {
    const maybeConfig: Partial<IConfigProviderBase> = obj;
    return maybeConfig?.getRawConfig !== undefined;
}
