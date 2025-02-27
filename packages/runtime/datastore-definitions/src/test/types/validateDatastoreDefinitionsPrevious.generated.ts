/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 * Generated by fluid-type-test-generator in @fluidframework/build-tools.
 */
import type * as old from "@fluidframework/datastore-definitions-previous";
import type * as current from "../../index.js";


// See 'build-tools/src/type-test-generator/compatibility.ts' for more information.
type TypeOnly<T> = T extends number
	? number
	: T extends string
	? string
	: T extends boolean | bigint | symbol
	? T
	: {
			[P in keyof T]: TypeOnly<T[P]>;
	  };

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannel": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IChannel():
    TypeOnly<old.IChannel>;
declare function use_current_InterfaceDeclaration_IChannel(
    use: TypeOnly<current.IChannel>): void;
use_current_InterfaceDeclaration_IChannel(
    get_old_InterfaceDeclaration_IChannel());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannel": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IChannel():
    TypeOnly<current.IChannel>;
declare function use_old_InterfaceDeclaration_IChannel(
    use: TypeOnly<old.IChannel>): void;
use_old_InterfaceDeclaration_IChannel(
    get_current_InterfaceDeclaration_IChannel());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelAttributes": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IChannelAttributes():
    TypeOnly<old.IChannelAttributes>;
declare function use_current_InterfaceDeclaration_IChannelAttributes(
    use: TypeOnly<current.IChannelAttributes>): void;
use_current_InterfaceDeclaration_IChannelAttributes(
    get_old_InterfaceDeclaration_IChannelAttributes());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelAttributes": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IChannelAttributes():
    TypeOnly<current.IChannelAttributes>;
declare function use_old_InterfaceDeclaration_IChannelAttributes(
    use: TypeOnly<old.IChannelAttributes>): void;
use_old_InterfaceDeclaration_IChannelAttributes(
    get_current_InterfaceDeclaration_IChannelAttributes());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelFactory": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IChannelFactory():
    TypeOnly<old.IChannelFactory>;
declare function use_current_InterfaceDeclaration_IChannelFactory(
    use: TypeOnly<current.IChannelFactory>): void;
use_current_InterfaceDeclaration_IChannelFactory(
    get_old_InterfaceDeclaration_IChannelFactory());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelFactory": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IChannelFactory():
    TypeOnly<current.IChannelFactory>;
declare function use_old_InterfaceDeclaration_IChannelFactory(
    use: TypeOnly<old.IChannelFactory>): void;
use_old_InterfaceDeclaration_IChannelFactory(
    get_current_InterfaceDeclaration_IChannelFactory());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelServices": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IChannelServices():
    TypeOnly<old.IChannelServices>;
declare function use_current_InterfaceDeclaration_IChannelServices(
    use: TypeOnly<current.IChannelServices>): void;
use_current_InterfaceDeclaration_IChannelServices(
    get_old_InterfaceDeclaration_IChannelServices());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelServices": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IChannelServices():
    TypeOnly<current.IChannelServices>;
declare function use_old_InterfaceDeclaration_IChannelServices(
    use: TypeOnly<old.IChannelServices>): void;
use_old_InterfaceDeclaration_IChannelServices(
    get_current_InterfaceDeclaration_IChannelServices());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelStorageService": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IChannelStorageService():
    TypeOnly<old.IChannelStorageService>;
declare function use_current_InterfaceDeclaration_IChannelStorageService(
    use: TypeOnly<current.IChannelStorageService>): void;
use_current_InterfaceDeclaration_IChannelStorageService(
    get_old_InterfaceDeclaration_IChannelStorageService());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IChannelStorageService": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IChannelStorageService():
    TypeOnly<current.IChannelStorageService>;
declare function use_old_InterfaceDeclaration_IChannelStorageService(
    use: TypeOnly<old.IChannelStorageService>): void;
use_old_InterfaceDeclaration_IChannelStorageService(
    get_current_InterfaceDeclaration_IChannelStorageService());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IDeltaConnection": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IDeltaConnection():
    TypeOnly<old.IDeltaConnection>;
declare function use_current_InterfaceDeclaration_IDeltaConnection(
    use: TypeOnly<current.IDeltaConnection>): void;
use_current_InterfaceDeclaration_IDeltaConnection(
    get_old_InterfaceDeclaration_IDeltaConnection());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IDeltaConnection": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IDeltaConnection():
    TypeOnly<current.IDeltaConnection>;
declare function use_old_InterfaceDeclaration_IDeltaConnection(
    use: TypeOnly<old.IDeltaConnection>): void;
use_old_InterfaceDeclaration_IDeltaConnection(
    get_current_InterfaceDeclaration_IDeltaConnection());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IDeltaHandler": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IDeltaHandler():
    TypeOnly<old.IDeltaHandler>;
declare function use_current_InterfaceDeclaration_IDeltaHandler(
    use: TypeOnly<current.IDeltaHandler>): void;
use_current_InterfaceDeclaration_IDeltaHandler(
    get_old_InterfaceDeclaration_IDeltaHandler());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IDeltaHandler": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IDeltaHandler():
    TypeOnly<current.IDeltaHandler>;
declare function use_old_InterfaceDeclaration_IDeltaHandler(
    use: TypeOnly<old.IDeltaHandler>): void;
use_old_InterfaceDeclaration_IDeltaHandler(
    get_current_InterfaceDeclaration_IDeltaHandler());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IFluidDataStoreRuntime": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IFluidDataStoreRuntime():
    TypeOnly<old.IFluidDataStoreRuntime>;
declare function use_current_InterfaceDeclaration_IFluidDataStoreRuntime(
    use: TypeOnly<current.IFluidDataStoreRuntime>): void;
use_current_InterfaceDeclaration_IFluidDataStoreRuntime(
    // @ts-expect-error compatibility expected to be broken
    get_old_InterfaceDeclaration_IFluidDataStoreRuntime());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IFluidDataStoreRuntime": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IFluidDataStoreRuntime():
    TypeOnly<current.IFluidDataStoreRuntime>;
declare function use_old_InterfaceDeclaration_IFluidDataStoreRuntime(
    use: TypeOnly<old.IFluidDataStoreRuntime>): void;
use_old_InterfaceDeclaration_IFluidDataStoreRuntime(
    // @ts-expect-error compatibility expected to be broken
    get_current_InterfaceDeclaration_IFluidDataStoreRuntime());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IFluidDataStoreRuntimeEvents": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_IFluidDataStoreRuntimeEvents():
    TypeOnly<old.IFluidDataStoreRuntimeEvents>;
declare function use_current_InterfaceDeclaration_IFluidDataStoreRuntimeEvents(
    use: TypeOnly<current.IFluidDataStoreRuntimeEvents>): void;
use_current_InterfaceDeclaration_IFluidDataStoreRuntimeEvents(
    get_old_InterfaceDeclaration_IFluidDataStoreRuntimeEvents());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_IFluidDataStoreRuntimeEvents": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_IFluidDataStoreRuntimeEvents():
    TypeOnly<current.IFluidDataStoreRuntimeEvents>;
declare function use_old_InterfaceDeclaration_IFluidDataStoreRuntimeEvents(
    use: TypeOnly<old.IFluidDataStoreRuntimeEvents>): void;
use_old_InterfaceDeclaration_IFluidDataStoreRuntimeEvents(
    get_current_InterfaceDeclaration_IFluidDataStoreRuntimeEvents());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith": {"forwardCompat": false}
*/
declare function get_old_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith():
    TypeOnly<old.Internal_InterfaceOfJsonableTypesWith<any>>;
declare function use_current_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith(
    use: TypeOnly<current.Internal_InterfaceOfJsonableTypesWith<any>>): void;
use_current_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith(
    get_old_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith": {"backCompat": false}
*/
declare function get_current_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith():
    TypeOnly<current.Internal_InterfaceOfJsonableTypesWith<any>>;
declare function use_old_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith(
    use: TypeOnly<old.Internal_InterfaceOfJsonableTypesWith<any>>): void;
use_old_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith(
    get_current_InterfaceDeclaration_Internal_InterfaceOfJsonableTypesWith());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "TypeAliasDeclaration_Jsonable": {"forwardCompat": false}
*/
declare function get_old_TypeAliasDeclaration_Jsonable():
    TypeOnly<old.Jsonable<any>>;
declare function use_current_TypeAliasDeclaration_Jsonable(
    use: TypeOnly<current.Jsonable<any>>): void;
use_current_TypeAliasDeclaration_Jsonable(
    get_old_TypeAliasDeclaration_Jsonable());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "TypeAliasDeclaration_Jsonable": {"backCompat": false}
*/
declare function get_current_TypeAliasDeclaration_Jsonable():
    TypeOnly<current.Jsonable<any>>;
declare function use_old_TypeAliasDeclaration_Jsonable(
    use: TypeOnly<old.Jsonable<any>>): void;
use_old_TypeAliasDeclaration_Jsonable(
    get_current_TypeAliasDeclaration_Jsonable());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "TypeAliasDeclaration_JsonableTypeWith": {"forwardCompat": false}
*/
declare function get_old_TypeAliasDeclaration_JsonableTypeWith():
    TypeOnly<old.JsonableTypeWith<any>>;
declare function use_current_TypeAliasDeclaration_JsonableTypeWith(
    use: TypeOnly<current.JsonableTypeWith<any>>): void;
use_current_TypeAliasDeclaration_JsonableTypeWith(
    get_old_TypeAliasDeclaration_JsonableTypeWith());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "TypeAliasDeclaration_JsonableTypeWith": {"backCompat": false}
*/
declare function get_current_TypeAliasDeclaration_JsonableTypeWith():
    TypeOnly<current.JsonableTypeWith<any>>;
declare function use_old_TypeAliasDeclaration_JsonableTypeWith(
    use: TypeOnly<old.JsonableTypeWith<any>>): void;
use_old_TypeAliasDeclaration_JsonableTypeWith(
    get_current_TypeAliasDeclaration_JsonableTypeWith());

/*
* Validate forward compat by using old type in place of current type
* If breaking change required, add in package.json under typeValidation.broken:
* "TypeAliasDeclaration_Serializable": {"forwardCompat": false}
*/
declare function get_old_TypeAliasDeclaration_Serializable():
    TypeOnly<old.Serializable<any>>;
declare function use_current_TypeAliasDeclaration_Serializable(
    use: TypeOnly<current.Serializable<any>>): void;
use_current_TypeAliasDeclaration_Serializable(
    get_old_TypeAliasDeclaration_Serializable());

/*
* Validate back compat by using current type in place of old type
* If breaking change required, add in package.json under typeValidation.broken:
* "TypeAliasDeclaration_Serializable": {"backCompat": false}
*/
declare function get_current_TypeAliasDeclaration_Serializable():
    TypeOnly<current.Serializable<any>>;
declare function use_old_TypeAliasDeclaration_Serializable(
    use: TypeOnly<old.Serializable<any>>): void;
use_old_TypeAliasDeclaration_Serializable(
    get_current_TypeAliasDeclaration_Serializable());
