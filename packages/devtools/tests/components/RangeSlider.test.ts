import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RangeSlider from '../../src/components/RangeSlider.vue';

describe('range slider', () => {
  it('keeps the Nuxt slider keyboard accessible and emits numeric updates', async () => {
    const wrapper = mount(RangeSlider, {
      props: {
        modelValue: 10,
        min: 0,
        max: 20,
        step: 5,
      },
      attrs: {
        'aria-label': 'Gain',
        'aria-valuetext': '10 decibels',
      },
    });
    const slider = wrapper.get('[role="slider"]');

    expect(slider.attributes()).toMatchObject({
      'aria-label': 'Gain',
      'aria-valuemax': '20',
      'aria-valuemin': '0',
      'aria-valuetext': '10 decibels',
    });

    await slider.trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.emitted('update:modelValue')).toContainEqual([15]);
  });
});
