import { expect, test } from '@playwright/test'

test('loads page and keeps Start disabled before safety confirmation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'AuMonitor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /using headphones/i }).check()
  await expect(page.getByRole('button', { name: 'Start' })).toBeEnabled()
})

test('shows fallback message when output selection is unsupported', async ({
  page,
}) => {
  await page.goto('/?forceNoSinkId=1')
  await expect(
    page.getByText('This browser does not support output device selection.'),
  ).toBeVisible()
  await expect(page.locator('#outputSelect')).toBeDisabled()
})

