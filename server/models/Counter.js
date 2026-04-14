const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, unique: true, index: true },
        seq: { type: Number, default: 0 },
    },
    { timestamps: true }
);

CounterSchema.statics.increment = async function (key) {
    const doc = await this.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return doc.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
