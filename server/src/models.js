import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// A saved search: the user's preferences plus how often to refresh it.
export const Search = model('Search', new Schema({
  name: String,
  prefs: { type: Object, required: true }, // shape comes from prefs.js normalizePrefs()
  refreshHours: { type: Number, default: 0 }, // 0 = manual only
  lastRun: { at: Date, stats: Object },
}, { timestamps: true, minimize: false }));

// One deduplicated, scored job listing found for a saved search.
export const Job = model('Job', new Schema({
  search: { type: Schema.Types.ObjectId, ref: 'Search', index: true },
  key: String, // dedupe fingerprint, unique per search
  title: String,
  company: String,
  location: String,
  url: String,
  sources: [{ _id: false, name: String, url: String }],
  level: String,
  remote: Boolean,
  type: String,
  salary: String,
  postedAt: Date,
  score: Number,
  reasons: [String],
  firstSeenAt: Date,
  lastSeenAt: Date,
  stale: Boolean,
  mark: { type: String, enum: ['', 'saved', 'applied', 'hidden'], default: '' },
}).index({ search: 1, key: 1 }, { unique: true }));
