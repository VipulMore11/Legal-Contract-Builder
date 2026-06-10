'use client'

import { Button } from '@/components/ui/button'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { useState } from 'react'

interface DataModel {
  id: string
  name: string
  fields: Array<{ name: string; type: string }>
}

export default function DataModelVisualizer() {
  const [models, setModels] = useState<DataModel[]>([
    {
      id: '1',
      name: 'Party',
      fields: [
        { name: 'name', type: 'String' },
        { name: 'email', type: 'String' },
        { name: 'address', type: 'String' },
        { name: 'phone', type: 'String' },
      ],
    },
    {
      id: '2',
      name: 'Compensation',
      fields: [
        { name: 'amount', type: 'Number' },
        { name: 'currency', type: 'String' },
        { name: 'dueDate', type: 'Date' },
        { name: 'paymentMethod', type: 'String' },
      ],
    },
    {
      id: '3',
      name: 'Term',
      fields: [
        { name: 'startDate', type: 'Date' },
        { name: 'endDate', type: 'Date' },
        { name: 'duration', type: 'String' },
        { name: 'renewalTerm', type: 'String' },
      ],
    },
  ])

  const [newModelName, setNewModelName] = useState('')
  const [showNewModel, setShowNewModel] = useState(false)

  const handleAddModel = () => {
    if (newModelName.trim()) {
      const newModel: DataModel = {
        id: Date.now().toString(),
        name: newModelName,
        fields: [],
      }
      setModels([...models, newModel])
      setNewModelName('')
      setShowNewModel(false)
    }
  }

  const handleDeleteModel = (id: string) => {
    setModels(models.filter(m => m.id !== id))
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'String':
        return 'bg-blue-500/20 text-blue-400'
      case 'Number':
        return 'bg-green-500/20 text-green-400'
      case 'Date':
        return 'bg-purple-500/20 text-purple-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Model</h1>
          <p className="text-muted-foreground mt-2">Define the structure of your contract data</p>
        </div>
        <Button onClick={() => setShowNewModel(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Data Model
        </Button>
      </div>

      {showNewModel && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold text-foreground mb-4">Create New Data Model</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="Enter model name (e.g., Party, Compensation)"
              className="flex-1 px-4 py-2 bg-card text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/50"
              onKeyPress={(e) => e.key === 'Enter' && handleAddModel()}
            />
            <Button onClick={handleAddModel} variant="default">
              Create
            </Button>
            <Button onClick={() => setShowNewModel(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => (
          <div
            key={model.id}
            className="bg-card rounded-lg border border-border overflow-hidden hover:border-primary transition-colors"
          >
            <div className="bg-primary/10 border-b border-border p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{model.name}</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteModel(model.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {model.fields.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">No fields defined yet</p>
                <Button variant="outline" size="sm" className="mt-3 w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </div>
            ) : (
              <div className="p-6 space-y-3">
                {model.fields.map((field, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-background rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{field.name}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${getTypeColor(field.type)}`}>
                      {field.type}
                    </span>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Field
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
        <h3 className="font-semibold text-foreground mb-2">What is a Data Model?</h3>
        <p className="text-sm text-muted-foreground">
          Data models define the structure of information in your contracts. Each model represents a concept (like a Party or Compensation) and contains fields that describe its properties.
        </p>
      </div>
    </div>
  )
}
