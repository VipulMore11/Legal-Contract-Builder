'use client'

import { Button } from '@/components/ui/button'
import { Copy, Eye, Edit2 } from 'lucide-react'
import { useState } from 'react'

interface Clause {
  id: string
  title: string
  category: string
  content: string
  description: string
}

export default function ClauseLibrary() {
  const [clauses] = useState<Clause[]>([
    {
      id: '1',
      title: 'Payment Terms',
      category: 'Financial',
      description: 'Defines payment schedule and methods',
      content: 'PAYMENT TERMS: Client shall pay Provider [AMOUNT] within [DAYS] days of invoice date. Payment shall be made via [METHOD].',
    },
    {
      id: '2',
      title: 'Confidentiality',
      category: 'Legal',
      description: 'Protects confidential information shared between parties',
      content: 'CONFIDENTIALITY: Both parties agree to maintain the confidentiality of all proprietary and sensitive information disclosed in connection with this Agreement.',
    },
    {
      id: '3',
      title: 'Termination',
      category: 'Legal',
      description: 'Outlines how and when the agreement can be terminated',
      content: 'TERMINATION: Either party may terminate this Agreement with [NOTICE PERIOD] days written notice. Upon termination, all obligations cease.',
    },
    {
      id: '4',
      title: 'Limitation of Liability',
      category: 'Legal',
      description: 'Limits financial responsibility in case of disputes',
      content: 'LIMITATION OF LIABILITY: In no event shall either party be liable for indirect, incidental, or consequential damages arising from this Agreement.',
    },
    {
      id: '5',
      title: 'Intellectual Property',
      category: 'Legal',
      description: 'Defines ownership of created work and materials',
      content: 'INTELLECTUAL PROPERTY: All work product created under this Agreement shall be the exclusive property of [OWNER].',
    },
    {
      id: '6',
      title: 'Non-Compete',
      category: 'Legal',
      description: 'Prevents parties from competing during and after agreement',
      content: 'NON-COMPETE: During the term and for [PERIOD] after termination, neither party shall engage in competing activities.',
    },
  ])

  const categories = ['All', 'Financial', 'Legal', 'Operational']
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredClauses = clauses.filter(clause => {
    const matchesCategory = selectedCategory === 'All' || clause.category === selectedCategory
    const matchesSearch = clause.title.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleCopyClause = (clause: Clause) => {
    navigator.clipboard.writeText(clause.content)
    alert(`Copied: ${clause.title}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Clause Library</h1>
        <p className="text-muted-foreground mt-2">Browse and reuse common contract clauses</p>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Search clauses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 bg-card text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat)}
              size="sm"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClauses.map((clause) => (
          <div
            key={clause.id}
            className="bg-card rounded-lg border border-border p-6 hover:border-primary transition-colors"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-foreground">{clause.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{clause.category}</p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{clause.description}</p>
            <div className="bg-background rounded p-3 mb-4 text-xs text-foreground font-mono line-clamp-3">
              {clause.content}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleCopyClause(clause)}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredClauses.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No clauses found matching your search.</p>
        </div>
      )}
    </div>
  )
}
