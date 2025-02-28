import React from 'react';
import { Story } from '@storybook/react';
import { allButtonVariants, Button, ButtonProps } from './Button';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { iconOptions } from '../../utils/storybook/knobs';
import mdx from './Button.mdx';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';
import { ButtonGroup } from './ButtonGroup';
import { ComponentSize } from '../../types/size';
import { Card } from '../Card/Card';

export default {
  title: 'Buttons/Button',
  component: Button,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  argTypes: {
    variant: { control: { type: 'select', options: ['primary', 'secondary', 'destructive', 'link'] } },
    size: { control: { type: 'select', options: ['sm', 'md', 'lg'] } },
    icon: { control: { type: 'select', options: iconOptions } },
    css: { control: { disable: true } },
    className: { control: { disable: true } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
};

export const Variants: Story<ButtonProps> = ({ children, ...args }) => {
  const sizes: ComponentSize[] = ['lg', 'md', 'sm'];

  return (
    <VerticalGroup>
      <HorizontalGroup spacing="lg">
        {allButtonVariants.map((variant) => (
          <VerticalGroup spacing="lg" key={variant}>
            {sizes.map((size) => (
              <Button variant={variant} size={size} key={size}>
                {variant} {size}
              </Button>
            ))}
            <Button variant={variant} disabled>
              {variant} disabled
            </Button>
          </VerticalGroup>
        ))}
      </HorizontalGroup>
      <div />
      <HorizontalGroup spacing="lg">
        <div>With icon and text</div>
        <Button icon="cloud" size="sm">
          Configure
        </Button>
        <Button icon="cloud">Configure</Button>
        <Button icon="cloud" size="lg">
          Configure
        </Button>
      </HorizontalGroup>
      <div />
      <HorizontalGroup spacing="lg">
        <div>With icon only</div>
        <Button icon="cloud" size="sm" />
        <Button icon="cloud" size="md" />
        <Button icon="cloud" size="lg" />
      </HorizontalGroup>
      <div />
      <Button icon="plus" fullWidth>
        Button with fullWidth
      </Button>
      <div />
      <HorizontalGroup spacing="lg">
        <div>Inside ButtonGroup</div>
        <ButtonGroup>
          <Button icon="sync">Run query</Button>
          <Button icon="angle-down" />
        </ButtonGroup>
      </HorizontalGroup>
      <Card heading="Button inside card">
        <Card.Actions>
          <>
            {allButtonVariants.map((variant) => (
              <Button variant={variant} key={variant}>
                {variant}
              </Button>
            ))}
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </>
        </Card.Actions>
      </Card>
    </VerticalGroup>
  );
};
