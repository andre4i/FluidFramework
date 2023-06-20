/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

export {
	Dependee,
	Dependent,
	NamedComputation,
	ObservingDependent,
	InvalidationToken,
	recordDependency,
	SimpleDependee,
	EmptyKey,
	FieldKey,
	TreeType,
	Value,
	TreeValue,
	AnchorSet,
	DetachedField,
	UpPath,
	FieldUpPath,
	Anchor,
	RootField,
	ChildCollection,
	ChildLocation,
	FieldMapObject,
	NodeData,
	GenericTreeNode,
	JsonableTree,
	Delta,
	rootFieldKey,
	rootField,
	rootFieldKeySymbol,
	fieldSchema,
	FieldScope,
	GlobalFieldKeySymbol,
	symbolFromKey,
	keyFromSymbol,
	symbolIsFieldKey,
	isGlobalFieldKey,
	ITreeCursor,
	CursorLocationType,
	ITreeCursorSynchronous,
	GenericFieldsNode,
	AnchorLocator,
	TreeNavigationResult,
	IEditableForest,
	IForestSubscription,
	TreeLocation,
	FieldLocation,
	ForestLocation,
	ITreeSubscriptionCursor,
	ITreeSubscriptionCursorState,
	LocalFieldKey,
	GlobalFieldKey,
	TreeSchemaIdentifier,
	TreeSchemaBuilder,
	NamedTreeSchema,
	Named,
	FieldStoredSchema,
	ValueSchema,
	TreeStoredSchema,
	StoredSchemaRepository,
	FieldKindIdentifier,
	TreeTypeSet,
	SchemaData,
	SchemaPolicy,
	SchemaDataAndPolicy,
	FieldAnchor,
	RevisionTag,
	TaggedChange,
	RepairDataStore,
	ReadonlyRepairDataStore,
	SchemaEvents,
	ForestEvents,
	PathRootPrefix,
	AnchorSlot,
	AnchorNode,
	anchorSlot,
	UpPathDefault,
	AnchorEvents,
	AnchorSetRootEvents,
	FieldKindSpecifier,
	AllowedUpdateType,
	PathVisitor,
	Adapters,
	FieldAdapter,
	TreeAdapter,
	MapTree,
} from "./core";

export {
	Brand,
	Opaque,
	extractFromOpaque,
	brand,
	brandOpaque,
	ValueFromBranded,
	NameFromBranded,
	JsonCompatibleReadOnly,
	JsonCompatible,
	JsonCompatibleObject,
	NestedMap,
	fail,
	TransactionResult,
	BrandedKey,
	BrandedMapSubset,
} from "./util";

export {
	Events,
	IsEvent,
	ISubscribable,
	createEmitter,
	IEmitter,
	NoListenersCallback,
	HasListeners,
} from "./events";

export {
	cursorToJsonObject,
	singleJsonCursor,
	jsonArray,
	jsonBoolean,
	jsonNull,
	jsonNumber,
	jsonObject,
	jsonString,
	jsonSchema,
	nodeIdentifierKey,
	nodeIdentifierSchema,
} from "./domains";

export {
	buildForest,
	ChangesetLocalId,
	emptyField,
	IdAllocator,
	neverTree,
	ModularChangeset,
	EditDescription,
	FieldChangeHandler,
	FieldEditor,
	FieldChangeRebaser,
	NodeChangeset,
	ValueChange,
	FieldChangeMap,
	FieldChangeset,
	FieldChange,
	ToDelta,
	NodeReviver,
	NodeChangeComposer,
	NodeChangeInverter,
	NodeChangeRebaser,
	CrossFieldManager,
	CrossFieldTarget,
	RevisionIndexer,
	RevisionMetadataSource,
	RevisionInfo,
	FieldKind,
	Multiplicity,
	isNeverField,
	FullSchemaPolicy,
	UnwrappedEditableField,
	isEditableTree,
	isEditableField,
	EditableTreeContext,
	UnwrappedEditableTree,
	EditableTreeOrPrimitive,
	EditableTree,
	EditableField,
	isPrimitiveValue,
	isPrimitive,
	getPrimaryField,
	typeSymbol,
	typeNameSymbol,
	valueSymbol,
	proxyTargetSymbol,
	getField,
	contextSymbol,
	ContextuallyTypedNodeDataObject,
	ContextuallyTypedNodeData,
	MarkedArrayLike,
	isContextuallyTypedNodeDataObject,
	defaultSchemaPolicy,
	jsonableTreeFromCursor,
	PrimitiveValue,
	NodeIdentifier,
	IDefaultEditBuilder,
	ValueFieldEditBuilder,
	OptionalFieldEditBuilder,
	SequenceFieldEditBuilder,
	prefixPath,
	prefixFieldPath,
	singleTextCursor,
	namedTreeSchema,
	singleStackTreeCursor,
	CursorAdapter,
	CursorWithNode,
	parentField,
	HasFieldChanges,
	EditableTreeEvents,
	on,
	ValueConstraint,
	InternalTypedSchemaTypes,
	SchemaAware,
	ArrayLikeMut,
	FieldKinds,
	SchemaCollection,
	ContextuallyTypedFieldData,
	ITreeSchema,
	IFieldSchema,
	cursorFromContextualData,
	UntypedField,
	UntypedTree,
	UntypedTreeContext,
	UntypedTreeCore,
	UnwrappedUntypedField,
	UnwrappedUntypedTree,
	UntypedTreeOrPrimitive,
	SchemaBuilder,
	FieldKindTypes,
	AllowedTypes,
	TreeSchema,
	BrandedFieldKind,
	ValueFieldKind,
	Optional,
	Sequence,
	NodeIdentifierFieldKind,
	Forbidden,
	TypedSchemaCollection,
	SchemaLibrary,
	SchemaLibraryData,
	FieldSchema,
	GlobalFieldSchema,
	Any,
	Sourced,
	NewFieldContent,
	NodeExistsConstraint,
	cursorForTypedTreeData,
	FieldGenerator,
	TreeDataContext,
	NodeExistenceState,
	createDataBinderBuffering,
	createDataBinderDirect,
	createDataBinderInvalidating,
	createBinderOptions,
	createFlushableBinderOptions,
	DataBinder,
	BinderOptions,
	Flushable,
	FlushableBinderOptions,
	FlushableDataBinder,
	MatchPolicy,
	BindSyntaxTree,
	indexSymbol,
	BindTree,
	BindTreeDefault,
	DownPath,
	BindPath,
	PathStep,
	BindingType,
	BindingContextType,
	BindingContext,
	VisitorBindingContext,
	DeleteBindingContext,
	InsertBindingContext,
	SetValueBindingContext,
	BatchBindingContext,
	InvalidationBindingContext,
	OperationBinderEvents,
	InvalidationBinderEvents,
	CompareFunction,
	BinderEventsCompare,
	AnchorsCompare,
	toDownPath,
	comparePipeline,
	compileSyntaxTree,
} from "./feature-libraries";

export {
	ISharedTree,
	ISharedTreeView,
	runSynchronous,
	SharedTreeFactory,
	SharedTreeOptions,
	SharedTreeView,
	ViewEvents,
	SchematizeConfiguration,
} from "./shared-tree";

export type {
	IBinaryCodec,
	ICodecFamily,
	ICodecOptions,
	IDecoder,
	IEncoder,
	IJsonCodec,
	IMultiFormatCodec,
	JsonValidator,
	SchemaValidationFunction,
} from "./codec";
export { noopValidator } from "./codec";
export { typeboxValidator } from "./external-utilities";

// Below here are things that are used by the above, but not part of the desired API surface.
import * as InternalTypes from "./internal";
export { InternalTypes };
