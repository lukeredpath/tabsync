import { test, expect } from './base';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

// Helper: intercept the oEmbed endpoint and return a fake response
async function mockOEmbed(page, title: string, authorName = 'SomeCoverChannel') {
  await page.route('**/oembed**', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ title, author_name: authorName }),
    })
  );
}

async function openAddTrackAndEnterUrl(page, url: string) {
  await page.locator('#add-track-btn').click();
  const dialog = page.getByRole('dialog', { name: /add track/i });
  await dialog.locator('#ef-tab-url').fill(url);
  await dialog.locator('#ef-tab-url').blur();
  return dialog;
}

const DUMMY_URL = 'https://www.youtube.com/watch?v=R2qjYGfAnEs';

test('parses "Artist - Song (noise)" into separate title and artist fields', async ({ page }) => {
  await mockOEmbed(page, "Queen - Don't Stop Me Now (Bass Cover)");
  const dialog = await openAddTrackAndEnterUrl(page, DUMMY_URL);

  await expect(dialog.locator('#ef-title')).toHaveValue("Don't Stop Me Now", { timeout: 5000 });
  await expect(dialog.locator('#ef-artist')).toHaveValue('Queen', { timeout: 5000 });
});

test('strips multiple trailing noise blocks', async ({ page }) => {
  await mockOEmbed(page, 'Metallica - Enter Sandman (Bass Tab) [HD]');
  const dialog = await openAddTrackAndEnterUrl(page, DUMMY_URL);

  await expect(dialog.locator('#ef-title')).toHaveValue('Enter Sandman', { timeout: 5000 });
  await expect(dialog.locator('#ef-artist')).toHaveValue('Metallica', { timeout: 5000 });
});

test('strips pipe-separated suffix', async ({ page }) => {
  await mockOEmbed(page, 'Pink Floyd - Comfortably Numb | Official Video');
  const dialog = await openAddTrackAndEnterUrl(page, DUMMY_URL);

  await expect(dialog.locator('#ef-title')).toHaveValue('Comfortably Numb', { timeout: 5000 });
  await expect(dialog.locator('#ef-artist')).toHaveValue('Pink Floyd', { timeout: 5000 });
});

test('fills title only when no artist separator is present', async ({ page }) => {
  await mockOEmbed(page, 'Comfortably Numb (Bass Cover)');
  const dialog = await openAddTrackAndEnterUrl(page, DUMMY_URL);

  await expect(dialog.locator('#ef-title')).toHaveValue('Comfortably Numb', { timeout: 5000 });
  await expect(dialog.locator('#ef-artist')).toHaveValue('', { timeout: 5000 });
});

test('does not overwrite fields the user has already filled in', async ({ page }) => {
  await mockOEmbed(page, "Queen - Don't Stop Me Now (Bass Cover)");
  await page.locator('#add-track-btn').click();
  const dialog = page.getByRole('dialog', { name: /add track/i });

  // Pre-fill artist
  await dialog.locator('#ef-artist').fill('My Artist');
  await dialog.locator('#ef-tab-url').fill(DUMMY_URL);
  await dialog.locator('#ef-tab-url').blur();

  await expect(dialog.locator('#ef-title')).toHaveValue("Don't Stop Me Now", { timeout: 5000 });
  await expect(dialog.locator('#ef-artist')).toHaveValue('My Artist');
});

test('strips second hyphen-separated suffix from title', async ({ page }) => {
  await mockOEmbed(page, 'TOOL - Schism - Bass Cover');
  const dialog = await openAddTrackAndEnterUrl(page, DUMMY_URL);

  await expect(dialog.locator('#ef-title')).toHaveValue('Schism', { timeout: 5000 });
  await expect(dialog.locator('#ef-artist')).toHaveValue('TOOL', { timeout: 5000 });
});

test('does not use YouTube channel name as artist', async ({ page }) => {
  await mockOEmbed(page, 'Comfortably Numb (Bass Cover)', 'TalkingBassOfficial');
  const dialog = await openAddTrackAndEnterUrl(page, DUMMY_URL);

  // Artist field should be empty — channel name should never populate it
  await expect(dialog.locator('#ef-artist')).toHaveValue('', { timeout: 5000 });
});
