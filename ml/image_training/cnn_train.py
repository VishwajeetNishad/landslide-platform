import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader, random_split

# Load data
X = np.load("training_data/X.npy")
y = np.load("training_data/y.npy")

# CNN input = (samples, channels, height, width)
X = torch.tensor(X[:, None, :, :], dtype=torch.float32)
y = torch.tensor(y, dtype=torch.long)

dataset = TensorDataset(X, y)

# 80/20 train-validation split
train_size = int(0.8 * len(dataset))
val_size = len(dataset) - train_size

train_ds, val_ds = random_split(
    dataset,
    [train_size, val_size],
    generator=torch.Generator().manual_seed(42)
)

train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
val_loader = DataLoader(val_ds, batch_size=32)

class LandslideCNN(nn.Module):
    def __init__(self):
        super().__init__()

        self.features = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(16, 32, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1))
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 2)
        )

    def forward(self, x):
        x = self.features(x)
        return self.classifier(x)

model = LandslideCNN()

criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

epochs = 15

for epoch in range(epochs):

    model.train()
    train_correct = 0
    train_total = 0

    for xb, yb in train_loader:
        optimizer.zero_grad()

        outputs = model(xb)
        loss = criterion(outputs, yb)

        loss.backward()
        optimizer.step()

        predictions = outputs.argmax(1)
        train_correct += (predictions == yb).sum().item()
        train_total += len(yb)

    model.eval()
    val_correct = 0
    val_total = 0

    with torch.no_grad():
        for xb, yb in val_loader:
            outputs = model(xb)
            predictions = outputs.argmax(1)

            val_correct += (predictions == yb).sum().item()
            val_total += len(yb)

    train_acc = train_correct / train_total
    val_acc = val_correct / val_total

    print(
        f"Epoch {epoch+1:02d}/{epochs} "
        f"| Train Acc: {train_acc:.3f} "
        f"| Val Acc: {val_acc:.3f}"
    )

torch.save(model.state_dict(), "landslide_cnn_event5.pth")

print("\nMODEL SAVED: landslide_cnn_event5.pth")
