import React from 'react';
import { cloneDeep } from 'lodash';
import {
  FieldConfigOptionsRegistry,
  SelectableValue,
  isSystemOverride as isSystemOverrideGuard,
  VariableSuggestionsScope,
  DynamicConfigValue,
} from '@grafana/data';
import { Container, fieldMatchersUI, ValuePicker } from '@grafana/ui';
import { OptionPaneRenderProps } from './types';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { DynamicConfigValueEditor } from './DynamicConfigValueEditor';
import { getDataLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';
import { OverrideCategoryTitle } from './OverrideCategoryTitle';

export function getFieldOverrideCategories(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor[] {
  const categories: OptionsPaneCategoryDescriptor[] = [];
  const currentFieldConfig = props.panel.fieldConfig;
  const registry = props.plugin.fieldConfigRegistry;
  const data = props.data?.series ?? [];

  const onOverrideChange = (index: number, override: any) => {
    let overrides = cloneDeep(currentFieldConfig.overrides);
    overrides[index] = override;
    props.onFieldConfigsChange({ ...currentFieldConfig, overrides });
  };

  const onOverrideRemove = (overrideIndex: number) => {
    let overrides = cloneDeep(currentFieldConfig.overrides);
    overrides.splice(overrideIndex, 1);
    props.onFieldConfigsChange({ ...currentFieldConfig, overrides });
  };

  const onOverrideAdd = (value: SelectableValue<string>) => {
    props.onFieldConfigsChange({
      ...currentFieldConfig,
      overrides: [
        ...currentFieldConfig.overrides,
        {
          matcher: {
            id: value.value!,
          },
          properties: [],
        },
      ],
    });
  };

  const context = {
    data,
    getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
  };

  /**
   * Main loop through all override rules
   */
  for (let idx = 0; idx < currentFieldConfig.overrides.length; idx++) {
    const override = currentFieldConfig.overrides[idx];
    const overrideName = `Override ${idx + 1}`;
    const matcherUi = fieldMatchersUI.get(override.matcher.id);
    const configPropertiesOptions = getOverrideProperties(registry);
    const isSystemOverride = isSystemOverrideGuard(override);
    // A way to force open new override categories
    const forceOpen = override.properties.length === 0 ? 1 : 0;

    const category = new OptionsPaneCategoryDescriptor({
      title: overrideName,
      id: overrideName,
      forceOpen,
      renderTitle: function renderOverrideTitle(isExpanded: boolean) {
        return (
          <OverrideCategoryTitle
            override={override}
            isExpanded={isExpanded}
            registry={registry}
            overrideName={overrideName}
            matcherUi={matcherUi}
            onOverrideRemove={() => onOverrideRemove(idx)}
          />
        );
      },
    });

    const onMatcherConfigChange = (options: any) => {
      override.matcher.options = options;
      onOverrideChange(idx, override);
    };

    const onDynamicConfigValueAdd = (value: SelectableValue<string>) => {
      const registryItem = registry.get(value.value!);
      const propertyConfig: DynamicConfigValue = {
        id: registryItem.id,
        value: registryItem.defaultValue,
      };

      if (override.properties) {
        override.properties.push(propertyConfig);
      } else {
        override.properties = [propertyConfig];
      }

      onOverrideChange(idx, override);
    };

    /**
     * Add override matcher UI element
     */
    category.addItem(
      new OptionsPaneItemDescriptor({
        title: matcherUi.name,
        render: function renderMatcherUI() {
          return (
            <matcherUi.component
              matcher={matcherUi.matcher}
              data={props.data?.series ?? []}
              options={override.matcher.options}
              onChange={onMatcherConfigChange}
            />
          );
        },
      })
    );

    /**
     * Loop through all override properties
     */
    for (let propIdx = 0; propIdx < override.properties.length; propIdx++) {
      const property = override.properties[propIdx];
      const registryItemForProperty = registry.getIfExists(property.id);

      if (!registryItemForProperty) {
        continue;
      }

      const onPropertyChange = (value: any) => {
        override.properties[propIdx].value = value;
        onOverrideChange(idx, override);
      };

      const onPropertyRemove = () => {
        override.properties.splice(propIdx, 1);
        onOverrideChange(idx, override);
      };

      /**
       * Add override property item
       */
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: registryItemForProperty.name,
          skipField: true,
          render: function renderPropertyEditor() {
            return (
              <DynamicConfigValueEditor
                key={`${property.id}/${propIdx}`}
                isSystemOverride={isSystemOverride}
                onChange={onPropertyChange}
                onRemove={onPropertyRemove}
                property={property}
                registry={registry}
                context={context}
              />
            );
          },
        })
      );
    }

    /**
     * Add button that adds new overrides
     */
    if (!isSystemOverride && override.matcher.options) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '----------',
          skipField: true,
          render: function renderAddPropertyButton() {
            return (
              <ValuePicker
                label="Add override property"
                variant="secondary"
                isFullWidth={false}
                icon="plus"
                menuPlacement="auto"
                options={configPropertiesOptions}
                onChange={onDynamicConfigValueAdd}
              />
            );
          },
        })
      );
    }

    categories.push(category);
  }

  categories.push(
    new OptionsPaneCategoryDescriptor({
      title: 'add button',
      id: 'add button',
      customRender: function renderAddButton() {
        return (
          <Container padding="md" key="Add override">
            <ValuePicker
              icon="plus"
              label="Add a field override"
              variant="secondary"
              size="sm"
              menuPlacement="auto"
              isFullWidth={false}
              options={fieldMatchersUI
                .list()
                .filter((o) => !o.excludeFromPicker)
                .map<SelectableValue<string>>((i) => ({ label: i.name, value: i.id, description: i.description }))}
              onChange={(value) => onOverrideAdd(value)}
            />
          </Container>
        );
      },
    })
  );

  //   <FeatureInfoBox
  //   title="Overrides"
  //   url={getDocsLink(DocsId.FieldConfigOverrides)}
  //   className={css`
  //     margin: ${theme.spacing.md};
  //   `}
  // >
  //   Field override rules give you fine-grained control over how your data is displayed.
  // </FeatureInfoBox>

  return categories;
}

function getOverrideProperties(registry: FieldConfigOptionsRegistry) {
  return registry
    .list()
    .filter((o) => !o.hideFromOverrides)
    .map((item) => {
      let label = item.name;
      if (item.category && item.category.length > 1) {
        label = [...item.category!.slice(1), item.name].join(' > ');
      }
      return {
        label,
        value: item.id,
        description: item.description,
      };
    });
}
