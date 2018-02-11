module.exports = (passThreshold, averageThreshold, failThreshold) => {
    return {
        pass: (passThreshold || 80),
        average: (averageThreshold || 70),
        fail: (failThreshold || 69)
    }
}